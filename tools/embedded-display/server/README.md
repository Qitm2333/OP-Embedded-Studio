# LCD Profile Build Server

This lightweight server exposes the profile registry and build action for the
`st7789_simple` example. It uses only the Python standard library.

## Start

Run it from any directory after loading ESP-IDF:

```bash
. /Users/fengqihao/esp-idf/export.sh
python3 /Users/fengqihao/esp-idf/examples/peripherals/lcd/st7789_simple/server/build_server.py
```

Default address:

```text
http://127.0.0.1:8765
```

Open the same URL in Chrome or Edge to use the local Web UI. The page can select
a profile, call the build API, and launch Web Serial flashing through
`esp-web-tools`.

For the server-side API contract, see `API.md`.
For engineering handoff notes and backend ownership boundaries, see
`HANDOFF.md`.

## APIs

```text
GET /api/health
GET /api/profiles
GET /api/image
POST /api/image
POST /api/image/clear
POST /api/build
GET /api/artifacts/<profileId>/manifest.json
GET /api/artifacts/<profileId>/<file>
```

Build request body:

```json
{
  "profileId": "st7735s_lb090r_if03"
}
```

The server reads `screen_profiles/profiles.json`, finds the selected profile's
`defaultsFile`, and runs:

```bash
idf.py -B build/profile_<profileId> \
  -DSDKCONFIG=build/profile_<profileId>/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;<profile defaults>" \
  build
```

The response includes the build command, return code, log tail, and firmware
artifact paths.

## Image Resource

The Web UI can optionally upload image resources before building. Supported
inputs are:

- One static `PNG` / `JPG` / `BMP` / `WebP`
- One animated `GIF`
- Multiple still images used as a frame sequence, commonly numbered `PNG` files

The browser expands animated GIFs into frames, sorts multiple selected images by
file name, applies the selected fit mode to every frame, converts each frame to
RGB565, and sends the frame data to:

Before uploading, the page renders the processed frames to a canvas preview.
Use Play/Pause to check animation timing, and Previous/Next Frame to inspect the
frame order and fit result.
The page also estimates RGB565 resource size, remaining resource budget, and the
maximum frame count for the selected screen profile. After building, it shows the
app binary size and free space in the 6 MiB app partition.

```text
POST /api/image
```

Request body:

```json
{
  "profileId": "st7735s_lb090r_if03",
  "name": "photo.png",
  "width": 128,
  "height": 128,
  "frameCount": 1,
  "frameDelayMs": 100,
  "pixelsRgb565Base64": "<base64 RGB565 little-endian bytes>"
}
```

The server writes `main/generated_image_user.h`, which is ignored by git. The
next build embeds the image frames into the firmware. Static images are stored
as one frame. Animated resources play in a loop at the selected frame rate. If
no uploaded image exists, the firmware shows the default geometry test pattern.

The server accepts up to 120 frames and up to 4 MiB of raw RGB565 frame data.
Use fewer frames or a lower frame rate if the app binary grows too large for the
partition.

The shared profile defaults use `partitions_8mb_no_ota.csv`, which provides a
single 6 MiB factory app partition for the verified 8 MiB ESP32-S3 board.

GIF parsing is loaded in the browser on demand from a CDN. Static images and
multi-image frame sequences do not need that parser.

To return to the default geometry test pattern:

```text
POST /api/image/clear
```

After a successful build, the manifest endpoint returns the firmware parts used
by browser-side flashing:

```text
0x0000   bootloader.bin
0x8000   partition-table.bin
0x10000  st7789_simple.bin
```

## Quick Test

```bash
python3 server/build_server.py --check
curl http://127.0.0.1:8765/api/profiles
curl -X POST http://127.0.0.1:8765/api/build \
  -H 'Content-Type: application/json' \
  -d '{"profileId":"st7735s_lb090r_if03"}'
```

For a complete no-Web demo flow, see `DEMO.md`.
