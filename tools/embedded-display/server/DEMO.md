# Server Demo Without Web UI

This document shows how to demonstrate the full server-side flow before the Web
UI is implemented:

```text
select screen profile
server reads profiles.json
server reads defaults
server runs ESP-IDF build
firmware is generated
firmware is flashed to the board
```

## Start The Server

Terminal 1:

```bash
cd /Users/fengqihao/esp-idf
. ./export.sh
python3 examples/peripherals/lcd/st7789_simple/server/build_server.py
```

Default URL:

```text
http://127.0.0.1:8765
```

Keep this terminal open.

## Check Health

Terminal 2:

```bash
curl http://127.0.0.1:8765/api/health
```

## Read Profiles

```bash
curl http://127.0.0.1:8765/api/profiles
```

## Build ST7735S Firmware

```bash
curl -X POST http://127.0.0.1:8765/api/build \
  -H 'Content-Type: application/json' \
  -d '{"profileId":"st7735s_lb090r_if03"}'
```

Expected response fields:

```json
{
  "profileId": "st7735s_lb090r_if03",
  "ok": true,
  "returnCode": 0
}
```

The generated app binary should be:

```text
examples/peripherals/lcd/st7789_simple/build/profile_st7735s_lb090r_if03/st7789_simple.bin
```

## Verify Generated Config

```bash
grep -E "CONFIG_EXAMPLE_LCD_CONTROLLER|CONFIG_EXAMPLE_LCD_H_RES|CONFIG_EXAMPLE_LCD_V_RES|CONFIG_EXAMPLE_LCD_INVERT_COLOR|CONFIG_EXAMPLE_LCD_RGB_ORDER" \
examples/peripherals/lcd/st7789_simple/build/profile_st7735s_lb090r_if03/sdkconfig
```

Expected ST7735S settings:

```text
CONFIG_EXAMPLE_LCD_CONTROLLER_ST7735=y
CONFIG_EXAMPLE_LCD_H_RES=128
CONFIG_EXAMPLE_LCD_V_RES=128
CONFIG_EXAMPLE_LCD_INVERT_COLOR=y
CONFIG_EXAMPLE_LCD_RGB_ORDER_BGR=y
```

## Flash The Generated Firmware

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7735s_lb090r_if03 \
  -p /dev/cu.usbmodem14101 flash
```

The screen should show the verified geometry test pattern.

