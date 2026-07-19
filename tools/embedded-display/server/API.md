# LCD Build Server API

This document is the server-side contract for the LCD profile build workflow.
It is intended for engineers who will replace, extend, or integrate with the
current lightweight Python server.

Related documents:

- `HANDOFF.md`: ownership boundaries, data flow, and backend handoff notes
- `README.md`: local startup and quick usage
- `DEMO.md`: command-line demo flow

## Base URL

```text
http://127.0.0.1:8765
```

The default server binds to `127.0.0.1`. It can be changed with:

```bash
python3 server/build_server.py --host 127.0.0.1 --port 8765
```

## Transport

- JSON request and response bodies use UTF-8.
- Binary artifact responses use `application/octet-stream`.
- The development server sends permissive CORS headers:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
- `HEAD` is supported for `GET` endpoints by the current implementation.
- `OPTIONS` returns `204 No Content`.

## Response Shape

Successful JSON responses include:

```json
{
  "ok": true
}
```

Error responses use the same shape:

```json
{
  "ok": false,
  "error": "human readable error message"
}
```

Build failures are special: `/api/build` returns a structured build result with
`ok: false`, `returnCode`, `command`, and `logTail`, using HTTP `500`.

## Limits

```text
Max raw RGB565 image data: 4 MiB
Max image request body field length: 6 MiB
Max frame count: 120
App partition size: 0x600000 bytes, 6 MiB
Build log tail returned: last 80 lines
```

RGB565 bytes are little-endian. Request bodies use base64, so payloads are
larger than the raw RGB565 data.

## Endpoint Summary

```text
GET  /api/health
GET  /api/profiles
GET  /api/image
POST /api/image
POST /api/image/clear
POST /api/build
GET  /api/artifacts/<profileId>/manifest.json
GET  /api/artifacts/<profileId>/manifest
GET  /api/artifacts/<profileId>/<file>
GET  /
GET  /index.html
GET  /static/<file>
```

## Health

### GET /api/health

Checks whether the server is running and reports the resolved example project
directory.

Example response:

```json
{
  "ok": true,
  "projectDir": "/Users/fengqihao/esp-idf/examples/peripherals/lcd/st7789_simple"
}
```

## Profiles

### GET /api/profiles

Returns the full contents of `screen_profiles/profiles.json`.

The Web UI uses this response for:

- Screen profile selection
- Wiring diagram rendering
- Display resolution and visible-area metadata
- Image payload validation inputs
- Build request `profileId`
- The `defaultsFile` used by the build API

The server validates each profile entry before returning the registry:

- Each profile must have a non-empty `id`.
- Each profile must have a non-empty `defaultsFile`.
- Profile IDs must be unique.
- `defaults.base` must exist.
- Referenced defaults files must exist inside the project directory.

Important fields:

```text
schemaVersion              Registry schema version.
project                    Example project path, for UI/context only.
board                      Verified board metadata and common GPIO hints.
defaults.base              Shared sdkconfig defaults used by all profiles.
profiles[].id              Stable profile ID used by API requests.
profiles[].displayName     English UI display name.
profiles[].displayNameZh   Chinese UI display name.
profiles[].controller      LCD controller family, for example ST7789, ST7735, or GC9D01N.
profiles[].logicalResolution
                           Required upload/build frame dimensions.
profiles[].visibleArea     Shape and clipping notes for the actual screen.
profiles[].physicalSize    Optional physical-size metadata; does not affect pixel scaling.
profiles[].defaultsFile    Profile-specific sdkconfig defaults.
profiles[].wiring          UI wiring table data.
profiles[].backlight       UI backlight guidance.
```

Example response fragment:

```json
{
  "schemaVersion": 1,
  "defaults": {
    "base": "screen_profiles/base.defaults"
  },
  "profiles": [
    {
      "id": "st7735s_lb090r_if03",
      "displayName": "LB090R-IF03 128x128 ST7735S",
      "displayNameZh": "LB090R-IF03 128x128 ST7735S 圆屏",
      "controller": "ST7735",
      "logicalResolution": {
        "width": 128,
        "height": 128
      },
      "visibleArea": {
        "shape": "round",
        "description": "Circular active area inside a 128 x 128 logical frame. Logical corners can be clipped by the round visible area."
      },
      "defaultsFile": "screen_profiles/st7735s_lb090r_if03.defaults"
    }
  ]
}
```

## Image Resource

### GET /api/image

Returns the current generated image header status.

Example response when an image exists:

```json
{
  "ok": true,
  "image": {
    "exists": true,
    "path": "/.../main/generated_image_user.h",
    "size": 409989
  }
}
```

Example response when no image exists:

```json
{
  "ok": true,
  "image": {
    "exists": false
  }
}
```

### POST /api/image

Uploads already-processed image frames.

The browser, not the server, is responsible for:

- Decoding PNG, JPG, BMP, WebP, and GIF input
- Sorting multi-file frame sequences
- Applying fit mode, rotation, background color, FPS, and frame picking
- Rendering preview frames
- Converting pixels to RGB565 little-endian bytes

Request body:

```json
{
  "profileId": "st7735s_lb090r_if03",
  "name": "demo-sequence",
  "width": 128,
  "height": 128,
  "frameCount": 24,
  "frameDelayMs": 100,
  "pixelsRgb565Base64": "<base64 RGB565 little-endian bytes>"
}
```

Fields:

```text
profileId             Required. Must match a known profile.
name                  Optional. Embedded in LCD_GENERATED_IMAGE_NAME.
width                 Required integer. Must match profile logical width.
height                Required integer. Must match profile logical height.
frameCount            Optional integer, default 1. Range: 1 to 120.
frameDelayMs          Optional integer, default 1000. Must be positive.
pixelsRgb565Base64    Required base64 string of RGB565 little-endian bytes.
```

Validation rules:

- `profileId` must match a known profile.
- `width` and `height` must match `profiles[].logicalResolution`.
- `frameCount` must be between 1 and 120.
- `frameDelayMs` must be positive.
- Decoded byte length must equal `width * height * 2 * frameCount`.
- Encoded payload length must be no more than 6 MiB.
- Decoded raw RGB565 data must be no more than 4 MiB.

The server writes:

```text
main/generated_image_user.h
```

The server also touches:

```text
main/generated_image.h
```

This forces the next incremental build to recompile the main component and pick
up the generated image resource.

Example response:

```json
{
  "ok": true,
  "image": {
    "name": "demo-sequence",
    "width": 128,
    "height": 128,
    "frameCount": 24,
    "frameDelayMs": 100,
    "pixelCount": 393216,
    "header": "/.../main/generated_image_user.h"
  }
}
```

### POST /api/image/clear

Deletes `main/generated_image_user.h` and touches `main/generated_image.h`.
The next build will show the built-in geometry test pattern.

Request body is ignored.

Example response:

```json
{
  "ok": true,
  "image": {
    "exists": false
  }
}
```

## Build

### POST /api/build

Builds firmware for one screen profile.

Request body:

```json
{
  "profileId": "st7735s_lb090r_if03"
}
```

The server resolves:

```text
screen_profiles/base.defaults
screen_profiles/<profile>.defaults
partitions_8mb_no_ota.csv
```

It then runs:

```bash
idf.py -B build/profile_<profileId> \
  -DSDKCONFIG=build/profile_<profileId>/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;<profile defaults>" \
  build
```

Build directories are signed with a hash of:

- `screen_profiles/base.defaults`
- The selected profile defaults file
- `partitions_8mb_no_ota.csv`

If those inputs change, the server deletes and recreates the profile build
directory to avoid stale `sdkconfig` values. Source changes are handled by the
normal ESP-IDF build system and do not change this signature.

The current Python implementation serializes build execution with a process-local
lock. It does not provide durable job IDs or a multi-user queue.

Example success response:

```json
{
  "profileId": "st7735s_lb090r_if03",
  "ok": true,
  "returnCode": 0,
  "command": [
    "idf.py",
    "-B",
    "build/profile_st7735s_lb090r_if03",
    "-DSDKCONFIG=build/profile_st7735s_lb090r_if03/sdkconfig",
    "-DSDKCONFIG_DEFAULTS=screen_profiles/base.defaults;screen_profiles/st7735s_lb090r_if03.defaults",
    "build"
  ],
  "artifacts": {
    "buildDir": "build/profile_st7735s_lb090r_if03",
    "appBin": "/.../build/profile_st7735s_lb090r_if03/st7789_simple.bin",
    "bootloaderBin": "/.../build/profile_st7735s_lb090r_if03/bootloader/bootloader.bin",
    "partitionTableBin": "/.../build/profile_st7735s_lb090r_if03/partition_table/partition-table.bin",
    "flashArgs": "/.../build/profile_st7735s_lb090r_if03/flash_args",
    "flasherArgsJson": "/.../build/profile_st7735s_lb090r_if03/flasher_args.json",
    "sdkconfig": "/.../build/profile_st7735s_lb090r_if03/sdkconfig"
  },
  "size": {
    "appBytes": 789760,
    "appPartitionBytes": 6291456,
    "appFreeBytes": 5501696
  },
  "logTail": [
    "st7789_simple.bin binary size ..."
  ]
}
```

Example build failure response:

```json
{
  "profileId": "st7735s_lb090r_if03",
  "ok": false,
  "returnCode": 2,
  "command": ["idf.py", "...", "build"],
  "artifacts": {
    "buildDir": "build/profile_st7735s_lb090r_if03"
  },
  "size": {
    "appBytes": 0,
    "appPartitionBytes": 6291456,
    "appFreeBytes": 6291456
  },
  "logTail": [
    "last 80 lines of build output"
  ]
}
```

If `idf.py` cannot be found, the server returns an error explaining that the
ESP-IDF environment must be loaded before starting the server.

## Browser Flashing Artifacts

### GET /api/artifacts/<profileId>/manifest.json

### GET /api/artifacts/<profileId>/manifest

Returns the manifest consumed by `esp-web-tools`.

The profile must be known, and all required artifact files must exist. If the
profile has not been built yet, the server returns `404`.

Example response:

```json
{
  "name": "LB090R-IF03 128x128 ST7735S",
  "version": "st7735s_lb090r_if03",
  "new_install_prompt_erase": true,
  "builds": [
    {
      "chipFamily": "ESP32-S3",
      "parts": [
        {
          "path": "/api/artifacts/st7735s_lb090r_if03/bootloader.bin",
          "offset": 0
        },
        {
          "path": "/api/artifacts/st7735s_lb090r_if03/partition-table.bin",
          "offset": 32768
        },
        {
          "path": "/api/artifacts/st7735s_lb090r_if03/st7789_simple.bin",
          "offset": 65536
        }
      ]
    }
  ],
  "profile": {
    "id": "st7735s_lb090r_if03",
    "displayName": "LB090R-IF03 128x128 ST7735S",
    "displayNameZh": "LB090R-IF03 128x128 ST7735S 圆屏",
    "controller": "ST7735",
    "resolution": {
      "width": 128,
      "height": 128
    }
  }
}
```

Manifest part offsets:

```text
0x0000   bootloader.bin
0x8000   partition-table.bin
0x10000  st7789_simple.bin
```

### GET /api/artifacts/<profileId>/<file>

Downloads one firmware artifact.

Supported file names:

```text
bootloader.bin
partition-table.bin
st7789_simple.bin
```

The server maps public file names to files inside the selected profile build
directory:

```text
bootloader.bin       -> build/profile_<profileId>/bootloader/bootloader.bin
partition-table.bin  -> build/profile_<profileId>/partition_table/partition-table.bin
st7789_simple.bin    -> build/profile_<profileId>/st7789_simple.bin
```

Unknown artifact names return `404`. Artifact path resolution is constrained to
the profile build directory.

## Static Web Files

The current server also serves the local Web UI:

```text
GET /             -> server/web/index.html
GET /index.html   -> server/web/index.html
GET /static/<file>
```

`/static/<file>` is constrained to `server/web/`, and can serve nested files such
as the local `server/web/vendor/esp-web-tools/` copy.

The current `index.html` intentionally loads `esp-web-tools` from CDN:

```text
https://cdn.jsdelivr.net/npm/esp-web-tools@10/dist/web/install-button.js
```

The local vendor files remain in the tree for follow-up work, but CDN flashing is
the currently verified path.

If the frontend and backend are separated later, these static endpoints can be
served by a normal static file host. The API contract above should remain stable.

## Common Status Codes

```text
200 OK                  Successful JSON or artifact response.
204 No Content          OPTIONS preflight response.
400 Bad Request         Invalid JSON, missing required field, invalid image data,
                        or path escaping the project/web directory.
404 Not Found           Unknown profile, endpoint, or artifact; artifacts not
                        built yet.
500 Internal Server     Profile registry/defaults errors, build failures,
                        missing idf.py, or unexpected server exceptions.
```
