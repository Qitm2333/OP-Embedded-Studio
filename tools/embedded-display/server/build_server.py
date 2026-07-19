#!/usr/bin/env python3
#
# SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
#
# SPDX-License-Identifier: CC0-1.0

import argparse
import base64
import csv
import hashlib
import json
import mimetypes
import os
import shutil
import struct
import subprocess
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


PROJECT_DIR = Path(__file__).resolve().parents[1]
SERVER_DIR = Path(__file__).resolve().parent
WEB_DIR = SERVER_DIR / "web"
PROFILES_JSON = PROJECT_DIR / "screen_profiles" / "profiles.json"
GENERATED_IMAGE_HEADER = PROJECT_DIR / "main" / "generated_image_user.h"
GENERATED_PROTOTYPE_HEADER = PROJECT_DIR / "main" / "generated_prototype_runtime.h"
GENERATED_CONTENT_DIR = PROJECT_DIR / "generated-content"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
LOG_TAIL_LINES = 80
MAX_IMAGE_PAYLOAD_BYTES = 6 * 1024 * 1024
MAX_IMAGE_RAW_BYTES = 4 * 1024 * 1024
MAX_IMAGE_FRAMES = 120
MAX_PROTOTYPE_STATES = 10
APP_PARTITION_BYTES = 0x300000
BUILD_LOCK = threading.Lock()

DEFAULT_BUILD_MODE = "usb-frame"
BUILD_MODES = {
    "usb-frame": {"partitionTable": "partitions_8mb_no_ota.csv", "appPartitionBytes": 0x600000},
    "usb-prototype": {"partitionTable": "partitions_8mb_no_ota.csv", "appPartitionBytes": 0x600000},
    "wifi-frame": {"partitionTable": "partitions_8mb_wireless.csv", "appPartitionBytes": 0x300000},
    "wifi-prototype": {"partitionTable": "partitions_8mb_wireless.csv", "appPartitionBytes": 0x300000},
}

PROTOTYPE_EVENTS = {
    "screen_click": "OPENPENCIL_EVENT_SCREEN_CLICK",
    "screen_long_press": "OPENPENCIL_EVENT_SCREEN_LONG_PRESS",
    "screen_double_click": "OPENPENCIL_EVENT_SCREEN_DOUBLE_CLICK",
    "screen_triple_click": "OPENPENCIL_EVENT_SCREEN_TRIPLE_CLICK",
    "boot_click": "OPENPENCIL_EVENT_BOOT_CLICK",
    "boot_long_press": "OPENPENCIL_EVENT_BOOT_LONG_PRESS",
}

ARTIFACT_FILES = {
    "bootloader.bin": ("bootloader/bootloader.bin", 0x0000),
    "partition-table.bin": ("partition_table/partition-table.bin", 0x8000),
    "st7789_simple.bin": ("st7789_simple.bin", 0x10000),
}
WIFI_CREDENTIALS_ARTIFACT = "wifi-credentials.bin"
WIFI_CREDENTIALS_OFFSET = 0x9000
NVS_PARTITION_SIZE = 0x6000


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def load_profile_registry():
    with PROFILES_JSON.open("r", encoding="utf-8") as f:
        registry = json.load(f)

    profile_ids = set()
    for profile in registry.get("profiles", []):
        profile_id = profile.get("id")
        defaults_file = profile.get("defaultsFile")
        if not profile_id or not defaults_file:
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "profile entry is missing id or defaultsFile")
        if profile_id in profile_ids:
            raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"duplicate profile id: {profile_id}")
        profile_ids.add(profile_id)
        resolve_project_file(defaults_file)

    base_defaults = registry.get("defaults", {}).get("base")
    if not base_defaults:
        raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "profiles registry is missing defaults.base")
    resolve_project_file(base_defaults)

    return registry


def resolve_project_file(relative_path):
    path = (PROJECT_DIR / relative_path).resolve()
    project_root = PROJECT_DIR.resolve()
    if path != project_root and project_root not in path.parents:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"path escapes project directory: {relative_path}")
    if not path.is_file():
        raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"file does not exist: {relative_path}")
    return path


def find_profile(registry, profile_id):
    for profile in registry.get("profiles", []):
        if profile.get("id") == profile_id:
            return profile
    raise ApiError(HTTPStatus.NOT_FOUND, f"unknown profileId: {profile_id}")


def normalize_build_mode(build_mode):
    mode = build_mode or DEFAULT_BUILD_MODE
    if mode not in BUILD_MODES:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"unknown buildMode: {mode}")
    return mode


def safe_path_segment(value):
    return "".join(ch if ch.isalnum() or ch in ("_", "-") else "_" for ch in value)


def build_dir_for_profile(profile_id, build_mode=DEFAULT_BUILD_MODE):
    safe_mode = safe_path_segment(normalize_build_mode(build_mode))
    safe_id = safe_path_segment(profile_id)
    return Path("build") / "modes" / safe_mode / f"profile_{safe_id}"


def generated_content_dir(profile_id, build_mode):
    return (
        GENERATED_CONTENT_DIR
        / safe_path_segment(normalize_build_mode(build_mode))
        / f"profile_{safe_path_segment(profile_id)}"
    )


def store_generated_resources(profile_id, build_mode):
    """Snapshot generated headers so build modes cannot overwrite each other."""
    content_dir = generated_content_dir(profile_id, build_mode)
    content_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(GENERATED_IMAGE_HEADER, content_dir / GENERATED_IMAGE_HEADER.name)
    shutil.copyfile(GENERATED_PROTOTYPE_HEADER, content_dir / GENERATED_PROTOTYPE_HEADER.name)


def restore_generated_resources(profile_id, build_mode):
    """Materialize the exact resource pair owned by the requested build mode."""
    content_dir = generated_content_dir(profile_id, build_mode)
    image_header = content_dir / GENERATED_IMAGE_HEADER.name
    prototype_header = content_dir / GENERATED_PROTOTYPE_HEADER.name
    if not image_header.is_file() or not prototype_header.is_file():
        resource_name = "状态机" if build_mode.endswith("-prototype") else "Frame"
        raise ApiError(
            HTTPStatus.BAD_REQUEST,
            f"{resource_name} 资源尚未准备，请先重新烘焙后再生成固件",
        )
    shutil.copyfile(image_header, GENERATED_IMAGE_HEADER)
    shutil.copyfile(prototype_header, GENERATED_PROTOTYPE_HEADER)
    touch_generated_image_wrapper()
    touch_generated_prototype_wrapper()


def ensure_wireless_base_resources(profile_id, build_mode):
    """Create and restore an empty resource pair for external-content firmware."""
    content_dir = generated_content_dir(profile_id, build_mode)
    image_header = content_dir / GENERATED_IMAGE_HEADER.name
    prototype_header = content_dir / GENERATED_PROTOTYPE_HEADER.name
    if not image_header.is_file() or not prototype_header.is_file():
        clear_generated_image()
        store_generated_resources(profile_id, build_mode)
    restore_generated_resources(profile_id, build_mode)


def find_idf_path():
    env_idf_path = os.environ.get("IDF_PATH")
    if env_idf_path:
        idf_path = Path(env_idf_path)
        if (idf_path / "tools" / "idf.py").is_file():
            return idf_path

    for parent in [PROJECT_DIR, *PROJECT_DIR.parents]:
        if (parent / "tools" / "idf.py").is_file():
            return parent

    # The desktop app commonly starts outside an activated ESP-IDF shell. Keep
    # installation discovery in the service adapter instead of leaking local
    # toolchain paths into the UI or firmware generation layers.
    if os.name == "nt":
        esp_root = Path(os.environ.get("ESP_IDF_INSTALL_ROOT", "D:/esp"))
        if esp_root.is_dir():
            candidates = sorted(esp_root.glob("v*/esp-idf"), reverse=True)
            for candidate in candidates:
                if (candidate / "tools" / "idf.py").is_file():
                    return candidate

    return None


def idf_setup_hint():
    if os.name == "nt":
        return (
            "Start the server from an ESP-IDF PowerShell/CMD environment, or run "
            "'D:\\esp-idf\\export.bat' before starting it. If ESP-IDF activation fails, "
            "check that Python 3.10+ is executable and IDF_TOOLS_PATH points to a valid "
            "Espressif tools directory."
        )
    return "Run '. /Users/fengqihao/esp-idf/export.sh' before starting the server."


def normalize_idf_env(env):
    if os.name != "nt":
        return

    tools_path = env.get("IDF_TOOLS_PATH")
    if not tools_path or not Path(tools_path).exists():
        user_profile = env.get("USERPROFILE")
        if user_profile:
            default_tools_path = Path(user_profile) / ".espressif"
            if default_tools_path.exists():
                env["IDF_TOOLS_PATH"] = str(default_tools_path)

    python_dir = find_windows_python_dir(env)
    if python_dir:
        env["PATH"] = str(python_dir) + os.pathsep + env.get("PATH", "")


def python_version(command, env=None):
    try:
        completed = subprocess.run(
            [str(command), "--version"],
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
    except OSError:
        return None
    if completed.returncode != 0:
        return None
    parts = completed.stdout.strip().split()
    if len(parts) < 2 or parts[0] != "Python":
        return None
    try:
        return tuple(int(part) for part in parts[1].split(".")[:2])
    except ValueError:
        return None


def find_windows_python_dir(env):
    current_python = shutil.which("python.exe", path=env.get("PATH", ""))
    current_version = python_version(current_python, env=env) if current_python else None
    if current_version and (3, 10) <= current_version < (3, 14):
        return None

    local_app_data = env.get("LOCALAPPDATA")
    if not local_app_data:
        return None

    python_root = Path(local_app_data) / "Programs" / "Python"
    for name in ("Python313", "Python312", "Python311", "Python310"):
        candidate_dir = python_root / name
        candidate_python = candidate_dir / "python.exe"
        try:
            if candidate_python.is_file():
                return candidate_dir
        except OSError:
            return candidate_dir

    return None


def idf_build_command(args):
    idf_path = find_idf_path()
    if os.name == "nt" and idf_path:
        export_bat = idf_path / "export.bat"
        if export_bat.is_file():
            idf_command = subprocess.list2cmdline(["python", str(idf_path / "tools" / "idf.py"), *args])
            cmd_command = f"call {export_bat} && {idf_command}"
            return [
                "cmd.exe",
                "/d",
                "/c",
                cmd_command,
            ]

    idf_executable = (
        shutil.which("idf.py")
        or shutil.which("idf.py.exe")
        or shutil.which("idf.py.bat")
        or shutil.which("idf.py.cmd")
    )
    if idf_executable:
        return [idf_executable, *args]

    if not idf_path:
        raise FileNotFoundError("idf.py")

    idf_py = idf_path / "tools" / "idf.py"
    return [sys.executable, str(idf_py), *args]


def mode_defaults_path(build_mode):
    mode = normalize_build_mode(build_mode)
    partition_table = BUILD_MODES[mode]["partitionTable"]
    path = PROJECT_DIR / "build" / "modes" / safe_path_segment(mode) / "mode.defaults"
    path.parent.mkdir(parents=True, exist_ok=True)
    wireless_enabled = mode.startswith("wifi-")
    external_content = mode == "wifi-frame"
    settings = [
        f'CONFIG_PARTITION_TABLE_CUSTOM_FILENAME="{partition_table}"',
        f'CONFIG_PARTITION_TABLE_FILENAME="{partition_table}"',
        f'CONFIG_OPENPENCIL_WIFI_SERVER={"y" if wireless_enabled else "n"}',
        f'CONFIG_OPENPENCIL_EXTERNAL_CONTENT_ONLY={"y" if external_content else "n"}',
    ]
    if wireless_enabled:
        settings.append("CONFIG_ESP_MAIN_TASK_STACK_SIZE=8192")
    settings.append("")
    contents = "\n".join(settings)
    if not path.is_file() or path.read_text(encoding="utf-8") != contents:
        path.write_text(contents, encoding="utf-8")
    return path.relative_to(PROJECT_DIR).as_posix()


def build_command(registry, profile, build_mode):
    base_defaults = registry["defaults"]["base"]
    profile_defaults = profile["defaultsFile"]
    build_dir = build_dir_for_profile(profile["id"], build_mode)
    sdkconfig = build_dir / "sdkconfig"
    defaults = f"{base_defaults};{profile_defaults};{mode_defaults_path(build_mode)}"

    return idf_build_command([
        "-B",
        build_dir.as_posix(),
        f"-DOPENPENCIL_BUILD_MODE={normalize_build_mode(build_mode)}",
        f"-DSDKCONFIG={sdkconfig.as_posix()}",
        f"-DSDKCONFIG_DEFAULTS={defaults}",
        "build",
    ])


def firmware_artifacts(build_dir):
    build_path = PROJECT_DIR / build_dir
    return {
        "buildDir": build_dir.as_posix(),
        "appBin": (build_path / "st7789_simple.bin").as_posix(),
        "bootloaderBin": (build_path / "bootloader" / "bootloader.bin").as_posix(),
        "partitionTableBin": (build_path / "partition_table" / "partition-table.bin").as_posix(),
        "flashArgs": (build_path / "flash_args").as_posix(),
        "flasherArgsJson": (build_path / "flasher_args.json").as_posix(),
        "sdkconfig": (build_path / "sdkconfig").as_posix(),
    }


def build_inputs_signature(registry, profile, build_mode):
    digest = hashlib.sha256()
    mode = normalize_build_mode(build_mode)
    paths = [
        registry["defaults"]["base"],
        profile["defaultsFile"],
        BUILD_MODES[mode]["partitionTable"],
        mode_defaults_path(mode),
    ]
    for relative_path in paths:
        path = resolve_project_file(relative_path)
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")

    stable_sources = [
        PROJECT_DIR / "CMakeLists.txt",
        PROJECT_DIR / "dependencies.lock",
        PROJECT_DIR / "main" / "CMakeLists.txt",
        PROJECT_DIR / "main" / "Kconfig.projbuild",
        PROJECT_DIR / "main" / "idf_component.yml",
        PROJECT_DIR / "components" / "openpencil_wifi_server" / "CMakeLists.txt",
    ]
    stable_sources.extend(
        path for path in (PROJECT_DIR / "main").glob("*.[ch]")
        if path.name not in ("generated_image_user.h", "generated_prototype_user.h")
    )
    for path in sorted(stable_sources):
        relative_path = path.relative_to(PROJECT_DIR).as_posix()
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")

    return digest.hexdigest()


def prepare_build_dir(registry, profile, build_mode, build_dir):
    build_path = PROJECT_DIR / build_dir
    signature_path = build_path / ".lcd_profile_build_signature"
    expected_signature = build_inputs_signature(registry, profile, build_mode)

    if build_path.exists():
        current_signature = signature_path.read_text(encoding="utf-8").strip() if signature_path.is_file() else ""
        if current_signature != expected_signature:
            shutil.rmtree(build_path)

    return expected_signature


def write_build_signature(build_dir, signature):
    build_path = PROJECT_DIR / build_dir
    build_path.mkdir(parents=True, exist_ok=True)
    (build_path / ".lcd_profile_build_signature").write_text(signature + "\n", encoding="utf-8")


def c_string_literal(value):
    return json.dumps(str(value), ensure_ascii=True)


def generated_image_status():
    if not GENERATED_IMAGE_HEADER.is_file():
        return {"exists": False}
    return {
        "exists": True,
        "path": GENERATED_IMAGE_HEADER.as_posix(),
        "size": GENERATED_IMAGE_HEADER.stat().st_size,
    }


def touch_generated_image_wrapper():
    wrapper = PROJECT_DIR / "main" / "generated_image.h"
    wrapper.touch()


def touch_generated_prototype_wrapper():
    (PROJECT_DIR / "main" / "generated_prototype.h").touch()


def write_disabled_prototype_header():
    """Keep single-image builds on the legacy display path."""
    GENERATED_PROTOTYPE_HEADER.write_text(
        "\n".join([
            "#pragma once",
            "",
            "#define OPENPENCIL_PROTOTYPE_ENABLED 0",
            '#define OPENPENCIL_PROTOTYPE_NAME "none"',
            "#define OPENPENCIL_PROTOTYPE_STATE_COUNT 0",
            "#define OPENPENCIL_PROTOTYPE_INITIAL_STATE 0",
            "#define OPENPENCIL_PROTOTYPE_TRANSITION_COUNT 0",
            'static const char *const openpencil_state_names[1] = {"none"};',
            "static const openpencil_transition_t openpencil_transitions[1] = {{0, 0, 0}};",
            "",
        ]),
        encoding="utf-8",
    )
    touch_generated_prototype_wrapper()


def write_generated_image_header(profile, body):
    """Generate independently addressable frame resources.

    Compression is deliberately a build-time operation. The device always
    expands exactly one complete frame into its DMA buffer before presenting it,
    so state transitions never perform image comparisons or allocate temporary
    buffers on the target.
    """
    width = body.get("width")
    height = body.get("height")
    frame_count = body.get("frameCount", 1)
    frame_delay_ms = body.get("frameDelayMs", 1000)
    image_name = body.get("name") or "uploaded image"
    encoded_pixels = body.get("pixelsRgb565Base64")
    resolution = profile.get("logicalResolution", {})

    if not isinstance(width, int) or not isinstance(height, int):
        raise ApiError(HTTPStatus.BAD_REQUEST, "image width and height must be integers")
    if not isinstance(frame_count, int) or frame_count < 1 or frame_count > MAX_IMAGE_FRAMES:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"frameCount must be between 1 and {MAX_IMAGE_FRAMES}")
    if not isinstance(frame_delay_ms, int) or frame_delay_ms < 1:
        raise ApiError(HTTPStatus.BAD_REQUEST, "frameDelayMs must be a positive integer")
    if width != resolution.get("width") or height != resolution.get("height"):
        raise ApiError(
            HTTPStatus.BAD_REQUEST,
            f"image size must match selected profile resolution: {resolution.get('width')}x{resolution.get('height')}",
        )
    if not isinstance(encoded_pixels, str) or not encoded_pixels:
        raise ApiError(HTTPStatus.BAD_REQUEST, "request body must include pixelsRgb565Base64")
    if len(encoded_pixels) > MAX_IMAGE_PAYLOAD_BYTES:
        raise ApiError(HTTPStatus.BAD_REQUEST, "image payload is too large")

    try:
        pixel_bytes = base64.b64decode(encoded_pixels, validate=True)
    except ValueError as exc:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"invalid base64 image payload: {exc}") from exc

    expected_bytes = width * height * 2 * frame_count
    if len(pixel_bytes) != expected_bytes:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"image payload size mismatch: expected {expected_bytes} bytes")
    if len(pixel_bytes) > MAX_IMAGE_RAW_BYTES:
        raise ApiError(
            HTTPStatus.BAD_REQUEST,
            f"image payload is too large: {len(pixel_bytes) // 1024}KB, limit is {MAX_IMAGE_RAW_BYTES // 1024}KB",
        )

    # The existing panel factory swaps RGB565 words for CO5300, ST7735 and
    # GC9D01N. Doing that once here makes the runtime raw path a memcpy.
    panel_native_swap = profile.get("controller") in {"CO5300", "ST7735", "GC9D01N"}
    pixels_per_frame = width * height
    frames = []
    stored_data = bytearray()
    compression_counts = {"raw": 0, "rle16": 0}

    for frame_index in range(frame_count):
        logical_frame = pixel_bytes[frame_index * pixels_per_frame * 2:(frame_index + 1) * pixels_per_frame * 2]
        if panel_native_swap:
            native_frame = bytearray(len(logical_frame))
            for offset in range(0, len(logical_frame), 2):
                native_frame[offset] = logical_frame[offset + 1]
                native_frame[offset + 1] = logical_frame[offset]
            native_frame = bytes(native_frame)
        else:
            native_frame = logical_frame

        rle_frame = bytearray()
        pixel_offset = 0
        while pixel_offset < pixels_per_frame:
            value_offset = pixel_offset * 2
            value = native_frame[value_offset:value_offset + 2]
            run = 1
            while (pixel_offset + run < pixels_per_frame
                   and native_frame[(pixel_offset + run) * 2:(pixel_offset + run + 1) * 2] == value
                   and run < 0xFFFF):
                run += 1
            rle_frame.extend(struct.pack("<H", run))
            rle_frame.extend(value)
            pixel_offset += run

        if len(rle_frame) < len(native_frame):
            codec = "LCD_FRAME_CODEC_RLE16"
            payload = bytes(rle_frame)
            compression_counts["rle16"] += 1
        else:
            codec = "LCD_FRAME_CODEC_RAW_RGB565"
            payload = native_frame
            compression_counts["raw"] += 1

        frame_offset = len(stored_data)
        stored_data.extend(payload)
        frames.append({
            "offset": frame_offset,
            "stored_bytes": len(payload),
            "pixel_count": pixels_per_frame,
            "codec": codec,
        })

    def format_bytes(data, values_per_line=24):
        values = [f"0x{value:02X}" for value in data]
        return ["    " + ", ".join(values[index:index + values_per_line]) + ","
                for index in range(0, len(values), values_per_line)] or ["    0x00,"]

    lines = [
        "#pragma once",
        "",
        "#include <stdint.h>",
        "",
        f"#define LCD_GENERATED_IMAGE_NAME {c_string_literal(image_name)}",
        f"#define LCD_GENERATED_IMAGE_WIDTH {width}",
        f"#define LCD_GENERATED_IMAGE_HEIGHT {height}",
        f"#define LCD_GENERATED_IMAGE_FRAME_COUNT {frame_count}",
        f"#define LCD_GENERATED_IMAGE_FRAME_DELAY_MS {frame_delay_ms}",
        f"#define LCD_GENERATED_IMAGE_PIXEL_COUNT {len(pixel_bytes) // 2}",
        "#define LCD_GENERATED_IMAGE_STORAGE_VERSION 1",
        f"#define LCD_GENERATED_IMAGE_STORED_BYTES {len(stored_data)}",
        f"#define LCD_GENERATED_IMAGE_PANEL_NATIVE {1 if panel_native_swap else 0}",
        "",
        "static const uint8_t lcd_generated_image_data[LCD_GENERATED_IMAGE_STORED_BYTES] __attribute__((aligned(4))) = {",
    ]
    lines.extend(format_bytes(stored_data))
    lines.extend(["};", "", "static const lcd_frame_resource_t lcd_generated_image_frames[LCD_GENERATED_IMAGE_FRAME_COUNT] = {"])
    lines.extend(
        f"    {{{frame['offset']}, {frame['stored_bytes']}, {frame['pixel_count']}, {frame['codec']}}},"
        for frame in frames
    )
    lines.extend(["};", ""])

    GENERATED_IMAGE_HEADER.write_text("\n".join(lines), encoding="utf-8")
    write_disabled_prototype_header()
    return {
        "ok": True,
        "image": {
            "name": image_name,
            "width": width,
            "height": height,
            "frameCount": frame_count,
            "frameDelayMs": frame_delay_ms,
            "pixelCount": len(pixel_bytes) // 2,
            "storedBytes": len(stored_data),
            "rawBytes": len(pixel_bytes),
            "compression": compression_counts,
            "panelNative": panel_native_swap,
            "header": GENERATED_IMAGE_HEADER.as_posix(),
        },
    }

def clear_generated_image():
    GENERATED_IMAGE_HEADER.write_text(
        "\n".join([
            "#pragma once",
            "",
            '#define LCD_GENERATED_IMAGE_NAME "none"',
            "#define LCD_GENERATED_IMAGE_WIDTH 0",
            "#define LCD_GENERATED_IMAGE_HEIGHT 0",
            "#define LCD_GENERATED_IMAGE_FRAME_COUNT 0",
            "#define LCD_GENERATED_IMAGE_FRAME_DELAY_MS 1000",
            "#define LCD_GENERATED_IMAGE_PIXEL_COUNT 0",
            "static const uint16_t lcd_generated_image_rgb565[1] = {0};",
            "",
        ]),
        encoding="utf-8",
    )
    write_disabled_prototype_header()
    return {"ok": True, "image": generated_image_status()}


def write_generated_prototype_header(profile, body):
    """Generate frame data plus a compact table for the generic device runtime."""
    if profile.get("controller") != "CO5300":
        raise ApiError(HTTPStatus.BAD_REQUEST, "prototype input runtime is currently available for the Waveshare CO5300 profile")
    states = body.get("states")
    transitions = body.get("transitions")
    initial_state = body.get("initialStateIndex")
    if not isinstance(states, list) or not 1 <= len(states) <= MAX_PROTOTYPE_STATES:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"states must contain 1 to {MAX_PROTOTYPE_STATES} items")
    if not isinstance(transitions, list):
        raise ApiError(HTTPStatus.BAD_REQUEST, "transitions must be an array")
    if not isinstance(initial_state, int) or not 0 <= initial_state < len(states):
        raise ApiError(HTTPStatus.BAD_REQUEST, "initialStateIndex is out of range")

    for state in states:
        if not isinstance(state, dict) or not isinstance(state.get("name"), str):
            raise ApiError(HTTPStatus.BAD_REQUEST, "each state must include a name")

    normalized_transitions = []
    for transition in transitions:
        if not isinstance(transition, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "each transition must be an object")
        from_state = transition.get("fromStateIndex")
        to_state = transition.get("toStateIndex")
        event = transition.get("event")
        if not isinstance(from_state, int) or not 0 <= from_state < len(states):
            raise ApiError(HTTPStatus.BAD_REQUEST, "transition fromStateIndex is out of range")
        if not isinstance(to_state, int) or not 0 <= to_state < len(states):
            raise ApiError(HTTPStatus.BAD_REQUEST, "transition toStateIndex is out of range")
        if event not in PROTOTYPE_EVENTS:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"unsupported prototype event: {event}")
        normalized_transitions.append((from_state, PROTOTYPE_EVENTS[event], to_state))

    write_generated_image_header(profile, {
        "width": body.get("width"),
        "height": body.get("height"),
        "frameCount": len(states),
        "frameDelayMs": 1000,
        "name": body.get("name") or "OpenPencil prototype",
        "pixelsRgb565Base64": body.get("pixelsRgb565Base64"),
    })

    lines = [
        "#pragma once",
        "",
        "#define OPENPENCIL_PROTOTYPE_ENABLED 1",
        f"#define OPENPENCIL_PROTOTYPE_NAME {c_string_literal(body.get('name') or 'OpenPencil prototype')}",
        f"#define OPENPENCIL_PROTOTYPE_STATE_COUNT {len(states)}",
        f"#define OPENPENCIL_PROTOTYPE_INITIAL_STATE {initial_state}",
        f"#define OPENPENCIL_PROTOTYPE_TRANSITION_COUNT {len(normalized_transitions)}",
        "",
        "static const char *const openpencil_state_names[OPENPENCIL_PROTOTYPE_STATE_COUNT] = {",
    ]
    lines.extend(f"    {c_string_literal(state['name'])}," for state in states)
    lines.extend(["};", "", "static const openpencil_transition_t openpencil_transitions[] = {"])
    lines.extend(
        f"    {{{from_state}, {event}, {to_state}}},"
        for from_state, event, to_state in normalized_transitions
    )
    if not normalized_transitions:
        lines.append("    {0, 0, 0},")
    lines.extend(["};", ""])
    GENERATED_PROTOTYPE_HEADER.write_text("\n".join(lines), encoding="utf-8")
    touch_generated_prototype_wrapper()
    return {"ok": True, "states": len(states), "transitions": len(normalized_transitions)}


def artifact_manifest(profile_id, build_mode=DEFAULT_BUILD_MODE):
    registry = load_profile_registry()
    profile = find_profile(registry, profile_id)
    mode = normalize_build_mode(build_mode)
    build_dir = build_dir_for_profile(profile_id, mode)
    build_path = PROJECT_DIR / build_dir
    missing = []
    parts = []

    def artifact_url(file_name):
        base = f"/api/artifacts/{profile_id}/{file_name}"
        return base if mode == "usb-frame" else f"{base}?mode={mode}"

    for public_name, (relative_path, offset) in ARTIFACT_FILES.items():
        artifact_path = build_path / relative_path
        if not artifact_path.is_file():
            missing.append(public_name)
            continue
        parts.append({
            "path": artifact_url(public_name),
            "offset": offset,
        })

    credentials_path = build_path / WIFI_CREDENTIALS_ARTIFACT
    if credentials_path.is_file():
        parts.append({
            "path": artifact_url(WIFI_CREDENTIALS_ARTIFACT),
            "offset": WIFI_CREDENTIALS_OFFSET,
        })

    if missing:
        raise ApiError(
            HTTPStatus.NOT_FOUND,
            f"missing firmware artifacts for {profile_id}: {', '.join(missing)}. Build the profile first.",
        )

    return {
        "name": profile.get("displayName", profile_id),
        "version": profile_id,
        "buildMode": mode,
        "new_install_prompt_erase": True,
        "builds": [
            {
                "chipFamily": "ESP32-S3",
                "parts": parts,
            }
        ],
        "profile": {
            "id": profile_id,
            "displayName": profile.get("displayName"),
            "displayNameZh": profile.get("displayNameZh"),
            "controller": profile.get("controller"),
            "resolution": profile.get("logicalResolution"),
        },
    }


def artifact_file_path(profile_id, file_name, build_mode=DEFAULT_BUILD_MODE):
    registry = load_profile_registry()
    find_profile(registry, profile_id)
    if file_name not in ARTIFACT_FILES and file_name != WIFI_CREDENTIALS_ARTIFACT:
        raise ApiError(HTTPStatus.NOT_FOUND, f"unknown artifact file: {file_name}")
    build_dir = build_dir_for_profile(profile_id, build_mode)
    relative_path = ARTIFACT_FILES[file_name][0] if file_name in ARTIFACT_FILES else file_name
    path = (PROJECT_DIR / build_dir / relative_path).resolve()
    build_root = (PROJECT_DIR / build_dir).resolve()
    if build_root != path and build_root not in path.parents:
        raise ApiError(HTTPStatus.BAD_REQUEST, "artifact path escapes build directory")
    if not path.is_file():
        raise ApiError(HTTPStatus.NOT_FOUND, f"artifact does not exist: {file_name}. Build the profile first.")
    return path


def write_wifi_credentials(build_path, credentials):
    artifact_path = build_path / WIFI_CREDENTIALS_ARTIFACT
    csv_path = build_path / "wifi-credentials.csv"
    if not credentials:
        artifact_path.unlink(missing_ok=True)
        csv_path.unlink(missing_ok=True)
        return

    ssid = credentials.get("ssid")
    password = credentials.get("password")
    if not isinstance(ssid, str) or not 1 <= len(ssid) <= 32:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Wi-Fi SSID must contain 1 to 32 characters")
    if not isinstance(password, str) or len(password) > 64:
        raise ApiError(HTTPStatus.BAD_REQUEST, "Wi-Fi password must contain at most 64 characters")

    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["key", "type", "encoding", "value"])
        writer.writerow(["wireless", "namespace", "", ""])
        writer.writerow(["ssid", "data", "string", ssid])
        writer.writerow(["password", "data", "string", password])

    idf_path = find_idf_path()
    if not idf_path:
        raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "ESP-IDF path was not found")
    idf_python = Path(sys.executable)
    python_env_root = Path.home() / ".espressif" / "python_env"
    candidates = sorted(python_env_root.glob("idf*_env/Scripts/python.exe"))
    if candidates:
        idf_python = candidates[-1]
    generator = idf_path / "components" / "nvs_flash" / "nvs_partition_generator" / "nvs_partition_gen.py"
    if not generator.is_file():
        raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, "ESP-IDF NVS partition generator was not found")
    completed = subprocess.run(
        [str(idf_python), str(generator), "generate", str(csv_path), str(artifact_path), hex(NVS_PARTITION_SIZE)],
        cwd=PROJECT_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    csv_path.unlink(missing_ok=True)
    if completed.returncode != 0:
        raise ApiError(HTTPStatus.INTERNAL_SERVER_ERROR, f"failed to generate Wi-Fi credentials: {completed.stdout}")


def run_build(profile_id, wifi_credentials=None, build_mode=DEFAULT_BUILD_MODE):
    registry = load_profile_registry()
    profile = find_profile(registry, profile_id)
    mode = normalize_build_mode(build_mode)
    command = build_command(registry, profile, mode)
    build_dir = build_dir_for_profile(profile_id, mode)

    env = os.environ.copy()
    env.setdefault("IDF_COMPONENT_MANAGER", "1")
    # Generated resource wrappers are touched after every upload. Ninja tracks
    # those wrappers and recompiles only their consumers, while ccache remains
    # available for stable ESP-IDF and display-driver sources.
    env.pop("CCACHE_DISABLE", None)
    normalize_idf_env(env)

    with BUILD_LOCK:
        if mode in ("usb-frame", "usb-prototype"):
            restore_generated_resources(profile_id, mode)
        elif mode in ("wifi-frame", "wifi-prototype"):
            ensure_wireless_base_resources(profile_id, mode)
        build_signature = prepare_build_dir(registry, profile, mode, build_dir)
        completed = subprocess.run(
            command,
            cwd=PROJECT_DIR,
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        if completed.returncode == 0:
            write_build_signature(build_dir, build_signature)
            write_wifi_credentials(PROJECT_DIR / build_dir, wifi_credentials)

    output_lines = completed.stdout.splitlines()
    artifacts = firmware_artifacts(build_dir)
    existing_artifacts = {
        name: path for name, path in artifacts.items()
        if name == "buildDir" or Path(path).exists()
    }
    app_bin_path = Path(artifacts["appBin"])
    app_size = app_bin_path.stat().st_size if app_bin_path.is_file() else 0

    return {
        "profileId": profile_id,
        "buildMode": mode,
        "ok": completed.returncode == 0,
        "returnCode": completed.returncode,
        "command": command,
        "artifacts": existing_artifacts,
        "size": {
            "appBytes": app_size,
            "appPartitionBytes": BUILD_MODES[mode]["appPartitionBytes"],
            "appFreeBytes": max(BUILD_MODES[mode]["appPartitionBytes"] - app_size, 0),
        },
        "logTail": output_lines[-LOG_TAIL_LINES:],
    }


def read_json_body(handler):
    content_length = int(handler.headers.get("Content-Length", "0"))
    if content_length <= 0:
        return {}
    raw_body = handler.rfile.read(content_length)
    try:
        return json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise ApiError(HTTPStatus.BAD_REQUEST, f"invalid JSON body: {exc}") from exc


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "lcd-profile-build-server/1.0"

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        self.handle_request("GET")

    def do_HEAD(self):
        self.handle_request("HEAD")

    def do_POST(self):
        self.handle_request("POST")

    def handle_request(self, method):
        try:
            parsed = urlparse(self.path)
            if method in ("GET", "HEAD") and parsed.path in ("/", "/index.html"):
                self.write_file(WEB_DIR / "index.html")
                return

            if method in ("GET", "HEAD") and parsed.path.startswith("/static/"):
                self.write_static_file(parsed.path)
                return

            if method in ("GET", "HEAD") and parsed.path == "/api/health":
                self.write_json({"ok": True, "projectDir": PROJECT_DIR.as_posix()})
                return

            if method in ("GET", "HEAD") and parsed.path == "/api/profiles":
                self.write_json(load_profile_registry())
                return

            if method in ("GET", "HEAD") and parsed.path == "/api/image":
                self.write_json({"ok": True, "image": generated_image_status()})
                return

            artifact_prefix = "/api/artifacts/"
            if method in ("GET", "HEAD") and parsed.path.startswith(artifact_prefix):
                build_mode = parse_qs(parsed.query).get("mode", [DEFAULT_BUILD_MODE])[0]
                suffix = parsed.path[len(artifact_prefix):].strip("/")
                parts = suffix.split("/")
                if len(parts) == 2 and parts[1] in ("manifest", "manifest.json"):
                    self.write_json(artifact_manifest(parts[0], build_mode))
                    return
                if len(parts) == 2:
                    self.write_file(
                        artifact_file_path(parts[0], parts[1], build_mode),
                        content_type="application/octet-stream",
                    )
                    return
                raise ApiError(HTTPStatus.NOT_FOUND, f"unknown artifact endpoint: {parsed.path}")

            if method == "POST" and parsed.path == "/api/build":
                body = read_json_body(self)
                profile_id = body.get("profileId")
                if not isinstance(profile_id, str) or not profile_id:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "request body must include non-empty profileId")
                result = run_build(profile_id, body.get("wifiCredentials"), body.get("buildMode"))
                status = HTTPStatus.OK if result["ok"] else HTTPStatus.INTERNAL_SERVER_ERROR
                self.write_json(result, status=status)
                return

            if method == "POST" and parsed.path == "/api/image":
                registry = load_profile_registry()
                body = read_json_body(self)
                profile_id = body.get("profileId")
                if not isinstance(profile_id, str) or not profile_id:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "request body must include non-empty profileId")
                profile = find_profile(registry, profile_id)
                with BUILD_LOCK:
                    result = write_generated_image_header(profile, body)
                    store_generated_resources(profile_id, "usb-frame")
                self.write_json(result)
                return

            if method == "POST" and parsed.path == "/api/prototype":
                registry = load_profile_registry()
                body = read_json_body(self)
                profile_id = body.get("profileId")
                if not isinstance(profile_id, str) or not profile_id:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "request body must include non-empty profileId")
                profile = find_profile(registry, profile_id)
                with BUILD_LOCK:
                    result = write_generated_prototype_header(profile, body)
                    store_generated_resources(profile_id, "usb-prototype")
                self.write_json(result)
                return

            if method == "POST" and parsed.path == "/api/image/clear":
                with BUILD_LOCK:
                    result = clear_generated_image()
                self.write_json(result)
                return

            raise ApiError(HTTPStatus.NOT_FOUND, f"unknown endpoint: {method} {parsed.path}")
        except ApiError as exc:
            self.write_json({"ok": False, "error": exc.message}, status=exc.status)
        except FileNotFoundError as exc:
            self.write_json({
                "ok": False,
                "error": f"failed to execute command: {exc}. {idf_setup_hint()}",
            }, status=HTTPStatus.INTERNAL_SERVER_ERROR)
        except Exception as exc:  # Keep API failures JSON-shaped for the Web client.
            self.write_json({"ok": False, "error": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def write_json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def write_static_file(self, request_path):
        relative = request_path[len("/static/"):]
        if not relative or relative.startswith("../") or "/../" in relative:
            raise ApiError(HTTPStatus.BAD_REQUEST, "invalid static path")
        path = (WEB_DIR / relative).resolve()
        web_root = WEB_DIR.resolve()
        if path != web_root and web_root not in path.parents:
            raise ApiError(HTTPStatus.BAD_REQUEST, "static path escapes web directory")
        self.write_file(path)

    def write_file(self, path, content_type=None):
        if not path.is_file():
            raise ApiError(HTTPStatus.NOT_FOUND, f"file not found: {path.name}")
        body = path.read_bytes()
        guessed_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_cors_headers()
        self.send_header("Content-Type", content_type or guessed_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


def parse_args():
    parser = argparse.ArgumentParser(description="LCD profile build API server")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--check", action="store_true", help="validate profiles.json and exit")
    return parser.parse_args()


def main():
    args = parse_args()
    if args.check:
        registry = load_profile_registry()
        print(json.dumps({
            "ok": True,
            "projectDir": PROJECT_DIR.as_posix(),
            "profiles": [profile["id"] for profile in registry.get("profiles", [])],
        }, ensure_ascii=False, indent=2))
        return 0

    server = ThreadingHTTPServer((args.host, args.port), RequestHandler)
    print(f"LCD profile build server listening on http://{args.host}:{args.port}")
    print(f"Project directory: {PROJECT_DIR}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
