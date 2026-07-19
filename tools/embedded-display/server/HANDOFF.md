# LCD Build Server Handoff

This document is for engineers who will take over, maintain, or reimplement the
current LCD profile build server.

Read it with:

- `API.md`: request and response contract
- `README.md`: local startup and quick usage
- `DEMO.md`: no-Web command-line demo
- `../screen_profiles/README.md`: profile file conventions

## Current State

The project already has a working end-to-end loop:

1. Select a verified screen profile in the Web UI.
2. Preview wiring and image resource settings.
3. Upload a static image, GIF, or frame sequence.
4. Browser preprocesses frames into RGB565.
5. Server writes the generated image header.
6. Server builds firmware for the selected profile.
7. Browser flashes the returned manifest through Web Serial.
8. The selected screen displays the built-in test pattern or uploaded resource.

The supported profiles are:

```text
st7789_qs130tab1005a   QS130TAB1005A 240x240 ST7789 square TFT
st7735s_lb090r_if03    LB090R-IF03 128x128 ST7735S round TFT
gc9d01n_gvh099wq010b_a0 GVH099WQ010B-A0 160x160 GC9D01N 0.99-inch round TFT, pending final hardware verification
```

At this stage, backend work should prioritize stability, observability, and
handoff clarity over changing the workflow shape.

## Scope

The current server is responsible for four things:

1. Expose the screen profile registry to the Web UI.
2. Accept processed image resources from the browser.
3. Build one firmware variant for one selected profile.
4. Expose build artifacts in a format compatible with browser-side flashing.

The current server does not:

- Parse raw user image files on the server.
- Flash the board directly.
- Manage users, auth, sessions, or persistence.
- Provide durable build jobs.
- Queue multiple concurrent users.
- Store historical uploads or historical build artifacts.

## Directory Map

```text
examples/peripherals/lcd/st7789_simple/
├── main/
│   ├── generated_image.h              # wrapper; includes generated_image_user.h when present
│   └── generated_image_user.h         # generated, gitignored
├── screen_profiles/
│   ├── README.md
│   ├── README_CN.md
│   ├── profiles.json                  # profile registry served by /api/profiles
│   ├── base.defaults                  # shared sdkconfig defaults
│   ├── st7789_qs130tab1005a.defaults
│   └── st7735s_lb090r_if03.defaults
├── partitions_8mb_no_ota.csv          # single 6 MiB app partition
└── server/
    ├── build_server.py                # current Python reference implementation
    ├── API.md
    ├── HANDOFF.md
    └── web/
        ├── index.html                 # loads esp-web-tools from CDN by default
        ├── app.js
        ├── styles.css
        └── vendor/esp-web-tools/      # retained for future offline/local flasher work
```

Generated and build-time files:

```text
main/generated_image_user.h
build/profile_<profileId>/
build/profile_<profileId>/.lcd_profile_build_signature
```

## Runtime Data Flow

### 1. Profile Load

The browser loads:

```text
GET /api/profiles
```

The server reads `screen_profiles/profiles.json`, validates that referenced
defaults files exist inside the project, and returns the registry.

The browser uses this for:

- Profile picker
- Resolution metadata
- Visible-area metadata
- Wiring diagram rendering
- Backlight guidance
- Build request `profileId`

### 2. Image Preparation

The browser is the image-processing worker.

It does all of the following before calling the server:

- Decode PNG, JPG, BMP, WebP, and GIF input
- Expand GIF frames
- Sort multi-file frame sequences
- Apply fit mode
- Apply rotation
- Apply background color
- Apply FPS and frame-pick mode
- Preview processed frames
- Convert pixels to RGB565 little-endian bytes

The server only validates the processed payload and writes a generated C header.

This boundary is important. Keeping raw image parsing in the browser avoids
adding image codecs and large upload/storage paths to the server.

### 3. Image Header Generation

The browser sends:

```text
POST /api/image
```

The server validates that the uploaded dimensions match the selected profile's
`logicalResolution`, then writes:

```text
main/generated_image_user.h
```

It also touches:

```text
main/generated_image.h
```

The touch step is required so incremental ESP-IDF builds recompile the main
component and include the latest image content.

`POST /api/image/clear` removes `generated_image_user.h`, restoring the built-in
geometry test pattern on the next build.

### 4. Build

The browser sends:

```text
POST /api/build
```

with one `profileId`.

The server then:

1. Loads `profiles.json`.
2. Resolves `screen_profiles/base.defaults`.
3. Resolves the selected profile `defaultsFile`.
4. Uses `partitions_8mb_no_ota.csv`.
5. Chooses build directory `build/profile_<profileId>`.
6. Invalidates that build directory if defaults or partition inputs changed.
7. Runs `idf.py build`.
8. Returns artifact paths, app size info, and the last 80 build log lines.

The build directory signature covers only defaults and the partition table. It
does not cover the source tree. ESP-IDF's own dependency tracking handles source
changes.

### 5. Flash

The server does not flash the board.

The browser uses:

```text
GET /api/artifacts/<profileId>/manifest.json
```

to feed `esp-web-tools`, which performs browser-side serial flashing.

Current flash layout:

```text
0x0000   bootloader.bin
0x8000   partition-table.bin
0x10000  st7789_simple.bin
```

## Server Responsibilities vs Browser Responsibilities

Browser responsibilities:

- User interaction
- Image preprocessing
- Image preview and animation playback
- Screen selection
- Wiring display
- Browser serial flashing
- User-facing flashing tips and troubleshooting

Server responsibilities:

- Profile registry validation and serving
- Processed image payload validation
- Generated header write and clear
- Build orchestration
- Build input invalidation for defaults and partition changes
- Artifact path resolution
- Manifest generation

This split is intentional. It keeps the server stateless and lightweight while
letting the browser own UI-heavy and codec-heavy work.

## Profile System

`screen_profiles/profiles.json` is the user-facing profile registry. Each profile
points to one defaults file. The build combines:

```text
screen_profiles/base.defaults
screen_profiles/<profile>.defaults
```

Profile metadata serves two audiences:

- Web UI: display names, shape, wiring, backlight guidance, resolution
- Build server: `id`, `defaultsFile`, and `logicalResolution`

When adding a new screen, update all of these together:

1. Add a profile defaults file.
2. Add a `profiles.json` entry.
3. Include wiring and backlight notes.
4. Verify `/api/profiles`.
5. Build with `/api/build`.
6. Flash and verify physical display output.

## Build Inputs

The build result for one profile currently depends on:

- `screen_profiles/base.defaults`
- `screen_profiles/<profile>.defaults`
- `partitions_8mb_no_ota.csv`
- Current source tree under `st7789_simple`
- Optional `main/generated_image_user.h`
- ESP-IDF version and active environment

The server assumes `idf.py` is available in the environment used to start the
server. Start it after running:

```bash
. /Users/fengqihao/esp-idf/export.sh
```

## Artifact Contract

The browser expects these build outputs:

- app binary
- bootloader binary
- partition table binary
- manifest JSON

The build response may also include:

- `flashArgs`
- `flasherArgsJson`
- `sdkconfig`

Those extra paths are useful for debugging, but browser flashing currently uses
the manifest plus the three binary downloads.

## Current Web Flasher Status

Browser flashing currently defaults to CDN-hosted `esp-web-tools`:

```text
https://cdn.jsdelivr.net/npm/esp-web-tools@10/dist/web/install-button.js
```

Reason:

- A local vendored copy was tested.
- The `Connect` button UI could load.
- Real device initialization during flashing was not reliable in local mode.
- The CDN path was verified to flash successfully on the same board.

For now, browser-flashing stability has priority over offline packaging.

The local vendor copy remains under:

```text
server/web/vendor/esp-web-tools/
```

Treat local flasher restoration as a separate follow-up task. It should not block
server API handoff work.

## Operational Constraints

### Board Assumption

Current defaults target the verified board:

- ESP32-S3
- 8 MiB flash
- 8 MiB PSRAM available on the tested board
- No OTA partition
- Single 6 MiB factory app partition

If the target board changes, update:

- Partition table
- Shared defaults
- Profile defaults
- Profile registry board metadata
- Manifest chip family if the SoC family changes

### Build Isolation

Each profile uses a separate build directory:

```text
build/profile_<profileId>
```

This avoids accidental reuse of `sdkconfig` values across screen types.

### Concurrency

The current Python server uses `ThreadingHTTPServer`, but build execution is
guarded by one process-local lock.

This is enough for local single-user development. It is not enough for a shared
service. A production backend should add:

- Durable job IDs
- Queueing
- Per-job or per-user workspaces
- Build cancellation
- Artifact retention policy
- Log streaming or polling

### Statefulness

The current server has one global generated image header:

```text
main/generated_image_user.h
```

That means two users building different images would overwrite each other. A
multi-user backend must isolate generated resources per job or per workspace.

## Known Failure Points

Build-side failures:

- ESP-IDF environment was not loaded before server startup.
- A profile references a missing defaults file.
- Defaults changed while an old build directory kept a stale `sdkconfig`.
- Generated image data makes the app binary too large.
- ESP-IDF dependency or source errors appear in `logTail`.

Flash-side failures:

- Browser does not support Web Serial.
- Serial port is already open in another program.
- ESP32-S3 did not enter download/bootloader mode.
- USB cable or board power is unstable.
- Local vendored `esp-web-tools` path is used before it is fixed.

The next UI stability task should turn these into distinct user-facing
troubleshooting cards.

## Recommended Backend Refactor Path

If this lightweight Python server is replaced by a fuller backend later, keep
these boundaries stable:

1. Preserve `/api/profiles` as the profile registry source.
2. Preserve `/api/image` as processed-RGB565 input, not raw file upload.
3. Preserve `/api/build` as one-profile-per-build.
4. Preserve `/api/artifacts/<profileId>/manifest.json` for browser flashing.
5. Preserve manifest part paths and offsets unless the partition layout changes.

A future backend can safely add:

- Job IDs
- Async build status polling
- Build log streaming
- Build history
- Artifact expiration
- Auth
- Persistent profile management
- Server-side profile validation reports

without breaking the current browser workflow.

## Suggested Next Backend Tasks

1. Convert build execution to explicit job objects.
2. Add structured build logs instead of log tail only.
3. Add artifact metadata endpoint with stable fields.
4. Add server-side validation report for profile integrity.
5. Add deployment documentation, not just local development instructions.
6. Add multi-user isolation before exposing this beyond localhost.

## Handoff Summary

The safest takeover path is to preserve the working loop and improve the backend
behind the same API:

```text
choose profile -> preprocess image in browser -> upload processed frames ->
build firmware -> serve manifest -> flash through browser serial
```

Do not redesign the browser/server boundary first. The current split is already
validated against real screens and real flashing.
