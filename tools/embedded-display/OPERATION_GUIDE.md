# LCD Bring-Up Operation Guide

This guide records the ESP32-S3 wiring and software configuration for the SPI LCD panels used with this project.

## Development Board

```text
MCU                 ESP32-S3
Package             QFN56
Flash               8 MB
PSRAM               8 MB embedded PSRAM
CPU                 Dual core, 240 MHz
Project target      esp32s3
```

Recommended software target:

```bash
idf.py -C examples/peripherals/lcd/st7789_simple set-target esp32s3
```

Avoid GPIO19 and GPIO20 for LCD signals on ESP32-S3 boards that use native USB, because those pins are commonly connected to USB D-/D+.

## Supported Screens

| Screen | Module / Spec | Driver IC | Resolution | Interface | Verified Status |
| --- | --- | --- | --- | --- | --- |
| Square TFT | QS130TAB1005A | ST7789P3-G5 / ST7789 compatible | 240 x 240 | 4-wire SPI | Verified OK |
| Round TFT | LB090R-IF03 | ST7735S | 128 x 128 | 4-wire SPI | Verified OK |
| Round TFT | GVH099WQ010B-A0 | GC9D01N | 160 x 160 | 4-wire SPI | Pending final hardware verification |

## Common ESP32-S3 GPIO Mapping

The project uses the same ESP32-S3 GPIO assignment for both LCDs:

| LCD Signal | ESP32-S3 GPIO | Notes |
| --- | --- | --- |
| SCLK / SCL | GPIO12 | SPI clock |
| SDA / MOSI | GPIO11 | SPI data to LCD |
| DC / RS / D/C | GPIO9 | Data/command select |
| RESET | GPIO14 | Active-low reset |
| CS | GPIO10 | SPI chip select |
| GND | GND | Common ground |
| VDD | 3V3 | LCD logic power |

MISO is not used and should remain `-1` in `menuconfig`.

## ST7789 240x240 Screen Wiring

Screen: `QS130TAB1005A`  
Driver IC: `ST7789P3-G5 / ST7789 compatible`  
Resolution: `240 x 240`

| ST7789 FPC Pin | Signal | Connect To |
| --- | --- | --- |
| Pin 1 | SDA | GPIO11 |
| Pin 2 | SCL | GPIO12 |
| Pin 3 | RS | GPIO9 |
| Pin 4 | RESET | GPIO14 |
| Pin 5 | CS | GPIO10 |
| Pin 6 | GND | GND |
| Pin 7 | VDD | 3V3 |
| Pin 8 | LEDK | Backlight cathode |
| Pin 9 | LEDA | Backlight anode |
| Pin 10 | GND | GND |

Backlight test wiring:

```text
LEDA -> 3V3
LEDK -> current-limit resistor -> GND
```

Verified ST7789 software settings:

```text
LCD controller IC        ST7789
Resolution               240 x 240
SPI pixel clock          10 MHz
RGB element order        RGB
Invert LCD colors        enabled
X gap                    0
Y gap                    0
Mirror X/Y               disabled
Swap X/Y                 disabled
```

## ST7735S 128x128 Round Screen Wiring

Screen: `LB090R-IF03`  
Driver IC: `ST7735S`  
Resolution: `128 x 128`  
Visible area: round active area inside a 128 x 128 logical frame.

| ST7735S FPC Pin | Signal | Connect To |
| --- | --- | --- |
| Pin 1 | GND | GND |
| Pin 2 | VDD | 3V3 |
| Pin 3 | SCLK | GPIO12 |
| Pin 4 | TE | Not connected |
| Pin 5 | RESET | GPIO14 |
| Pin 6 | CS | GPIO10 |
| Pin 7 | SDA | GPIO11 |
| Pin 8 | D/C | GPIO9 |
| Pin 9 | LEDK | Backlight cathode |
| Pin 10 | LEDA | Backlight anode |

Backlight note:

```text
LEDA -> 3V3 or backlight driver positive output
LEDK -> current-limit resistor / constant-current driver -> GND
```

The LB090R-IF03 specification lists the backlight as 3 white LEDs, `2.9V~3.1V`, `60mA` typical. A constant-current backlight driver is preferred. Do not drive the backlight directly from an ESP32 GPIO.

Verified ST7735S software settings:

```text
LCD controller IC        ST7735
Resolution               128 x 128
SPI pixel clock          10 MHz
RGB element order        BGR
Invert LCD colors        enabled
X gap                    0
Y gap                    0
Mirror X/Y               disabled
Swap X/Y                 disabled
```

## GC9D01N 160x160 0.99-Inch Round Screen Wiring

Screen: `GVH099WQ010B-A0`  
Driver IC: `GC9D01N`  
Resolution: `160 x 160`  
Visible area: 0.99-inch round active area inside a 160 x 160 logical frame.

| GC9D01N FPC Pin | Signal | Connect To |
| --- | --- | --- |
| Pin 1 | GND | GND |
| Pin 2 | SDA | GPIO11 |
| Pin 3 | SCL | GPIO12 |
| Pin 4 | RS | GPIO9 |
| Pin 5 | RESET | GPIO14 |
| Pin 6 | CS | GPIO10 |
| Pin 7 | VCC | 3V3 |
| Pin 8 | LEDK | Backlight cathode |
| Pin 9 | LEDA | Backlight anode |
| Pin 10 | GND | GND |

Backlight note:

```text
LEDA -> 3V3 or backlight driver positive output
LEDK -> current-limit resistor / constant-current driver -> GND
```

The GVH099WQ010B-A0 specification lists the active area as `23.1 x 23.1 mm` and the backlight as 2 white LEDs, `2.8V~3.2V`, `40mA` typical. Firmware writes a `160 x 160` pixel frame; the 0.99-inch physical size is metadata and does not change pixel scaling.

Current GC9D01N software settings:

```text
LCD controller IC        GC9D01N
Resolution               160 x 160
SPI pixel clock          10 MHz
RGB element order        RGB
Invert LCD colors        disabled
X gap                    0
Y gap                    0
Mirror X/Y               disabled
Swap X/Y                 disabled
```

## Menuconfig

Run:

```bash
cd /Users/fengqihao/esp-idf
. ./export.sh
idf.py -C examples/peripherals/lcd/st7789_simple menuconfig
```

Open:

```text
Example Configuration
```

Set these items according to the screen:

| Option | ST7789 240x240 | ST7735S 128x128 | GC9D01N 160x160 |
| --- | --- | --- | --- |
| LCD controller IC | ST7789 | ST7735 | GC9D01N |
| LCD horizontal resolution | 240 | 128 | 160 |
| LCD vertical resolution | 240 | 128 | 160 |
| LCD pixel clock | 10000000 | 10000000 | 10000000 |
| LCD RGB element order | RGB | BGR | RGB |
| Invert LCD colors | enabled | enabled | disabled |
| LCD X gap/offset | 0 | 0 | 0 |
| LCD Y gap/offset | 0 | 0 | 0 |

## Screen Profiles

The verified screen settings are also available as reusable profile files under
`screen_profiles/`.

| Profile ID | Defaults File |
| --- | --- |
| `st7789_qs130tab1005a` | `screen_profiles/st7789_qs130tab1005a.defaults` |
| `st7735s_lb090r_if03` | `screen_profiles/st7735s_lb090r_if03.defaults` |
| `gc9d01n_gvh099wq010b_a0` | `screen_profiles/gc9d01n_gvh099wq010b_a0.defaults` |

Use `screen_profiles/profiles.json` as the source for Web UI screen names,
physical wiring hints, backlight notes, and the matching defaults file.

For non-interactive builds, combine the common board defaults with one selected
screen defaults file:

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7789 \
  -DSDKCONFIG=build/profile_st7789/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7789_qs130tab1005a.defaults" \
  build
```

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7735s \
  -DSDKCONFIG=build/profile_st7735s/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7735s_lb090r_if03.defaults" \
  build
```

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_gc9d01n_gvh099wq010b_a0 \
  -DSDKCONFIG=build/profile_gc9d01n_gvh099wq010b_a0/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/gc9d01n_gvh099wq010b_a0.defaults" \
  build
```

If a profile defaults file changes after a build directory already exists, use a
new build directory or delete that profile's generated `sdkconfig`. ESP-IDF can
preserve existing `sdkconfig` values instead of replacing them from defaults.

## Build And Flash

```bash
cd /Users/fengqihao/esp-idf
. ./export.sh
idf.py -C examples/peripherals/lcd/st7789_simple build
idf.py -C examples/peripherals/lcd/st7789_simple flash monitor
```

## Expected Display

After flashing, the firmware displays a geometry test pattern:

```text
Black background
White 1-pixel border
Gray grid lines
Red marker near top-left
Green marker near top-right
Blue marker near bottom-left
Yellow marker near bottom-right
White cross at center
```

Coordinate direction:

```text
Red -> Green   X positive direction, left to right
Red -> Blue    Y positive direction, top to bottom
Red marker     near logical origin (0, 0)
Yellow marker  near logical bottom-right corner
```

For the round screens, the logical frame is still square (`128 x 128` for ST7735S and `160 x 160` for GC9D01N), but the physically visible area is circular. Corners may be clipped by the round active area, which is normal.

## Quick Troubleshooting

| Symptom | Check |
| --- | --- |
| Backlight off | LEDA/LEDK wiring, current-limit resistor, common GND |
| Backlight on but no image | SCLK, SDA, D/C, CS, RESET wiring; correct IC selected in menuconfig |
| Red/blue swapped | Toggle RGB/BGR order |
| Black/white reversed | Toggle color inversion |
| Image shifted/clipped | Adjust X gap / Y gap |
| Random colored lines | Reduce SPI clock, shorten wires, improve GND connection |
