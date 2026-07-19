# ST7789 SPI LCD Simple Example

This example initializes an SPI LCD panel and draws a geometry test pattern. It supports selecting ST7789, ST7735, or GC9D01N from `menuconfig`, and is intended as a first hardware bring-up project before adding LVGL or touch support.

## Verified Baseline

Validated on 2026-06-04 12:14 CST with an ESP32-S3 QFN56 board and a QS130TAB1005A 240x240 ST7789 SPI LCD.

Known-good settings:

```text
Target              esp32s3
Resolution          240 x 240
SPI pixel clock     10 MHz
Color order         RGB
Color inversion     enabled
X gap               0
Y gap               0
Mirror X/Y          disabled
Swap X/Y            disabled
Framebuffer update  full 240x240 frame in one SPI transfer
```

The verified screen output is a black background with a white 1-pixel border, gray 40-pixel grid lines, four inset corner color markers, and a white center cross. This version fixed the previous color mismatch, black/white inversion, and unstable stray red line seen at 20 MHz.

## Hardware

Connect the LCD module to the ESP board. For the 10-pin 240x240 ST7789 FPC panel:

```text
ST7789 FPC    ESP GPIO/default wiring
Pin 1 SDA     GPIO11 MOSI
Pin 2 SCL     GPIO12 SCLK
Pin 3 RS      GPIO9 DC
Pin 4 RESET   GPIO14
Pin 5 CS      GPIO10
Pin 6 GND     GND
Pin 7 VDD     3V3
Pin 8 LEDK    Backlight cathode
Pin 9 LEDA    Backlight anode
Pin 10 GND    GND
```

For the LB090R-IF03 ST7735S 128x128 FPC panel:

```text
ST7735S FPC   ESP GPIO/default wiring
Pin 1 GND     GND
Pin 2 VDD     3V3
Pin 3 SCLK    GPIO12 SCLK
Pin 4 TE      Not connected
Pin 5 RESET   GPIO14
Pin 6 CS      GPIO10
Pin 7 SDA     GPIO11 MOSI
Pin 8 D/C     GPIO9 DC
Pin 9 LEDK    Backlight cathode
Pin 10 LEDA   Backlight anode
```

For the GVH099WQ010B-A0 GC9D01N 160x160 0.99-inch round FPC panel:

```text
GC9D01N FPC   ESP GPIO/default wiring
Pin 1 GND     GND
Pin 2 SDA     GPIO11 MOSI
Pin 3 SCL     GPIO12 SCLK
Pin 4 RS      GPIO9 DC
Pin 5 RESET   GPIO14
Pin 6 CS      GPIO10
Pin 7 VCC     3V3
Pin 8 LEDK    Backlight cathode
Pin 9 LEDA    Backlight anode
Pin 10 GND    GND
```

MISO is not required for these SPI display modules and defaults to `-1`.
If the backlight is wired always on, set `LCD backlight GPIO` to `-1`. If you want GPIO backlight control, drive LEDA/LEDK through a suitable resistor and transistor/MOSFET circuit instead of powering the LED directly from a GPIO. The LB090R-IF03 ST7735S backlight is specified at 2.9-3.1 V and 60 mA typical. The GVH099WQ010B-A0 GC9D01N backlight is specified as 2 white LEDs, 2.8-3.2 V and 40 mA typical. A constant-current backlight driver is preferred for both round screens.
For ESP32-S3 boards that use native USB, avoid GPIO19/GPIO20 because they are commonly connected to USB D-/D+.

## Configure

Run:

```bash
idf.py menuconfig
```

Then open `Example Configuration`.

Important options:

- `LCD controller IC`: select `ST7789`, `ST7735`, or `GC9D01N`.
- `LCD horizontal resolution` / `LCD vertical resolution`: ST7789 baseline is `240 x 240`; LB090R-IF03 ST7735S is `128 x 128`; GVH099WQ010B-A0 GC9D01N is `160 x 160`.
- `LCD RGB element order`: QS130TAB1005A ST7789 uses `RGB`; LB090R-IF03 ST7735S uses `BGR`; GVH099WQ010B-A0 GC9D01N uses `RGB`.
- `Invert LCD colors`: QS130TAB1005A ST7789 and LB090R-IF03 ST7735S use enabled inversion in their profiles; GVH099WQ010B-A0 GC9D01N uses disabled inversion.
- `LCD X gap/offset` / `LCD Y gap/offset`: tune if the image is shifted or clipped.
- `Mirror LCD on X/Y axis` and `Swap LCD X/Y axes`: tune display direction.

Common notes:

- Most small ST7789 modules are `240x320`, `240x240`, or `135x240`.
- Common ST7735 modules include `128x160`, `128x128`, and `80x160`; many require non-zero X/Y gap values depending on tab/module type.
- The GVH099WQ010B-A0 GC9D01N profile uses a `160 x 160` logical frame for the 0.99-inch round active area. Physical size is profile metadata and does not change firmware pixel scaling.
- If colors look wrong, switch between RGB/BGR or enable color inversion.
- If the image is shifted, tune the X/Y gap values.
- If the screen is rotated or mirrored, adjust mirror/swap settings.

For non-interactive profile builds, use the defaults files in `screen_profiles/`.
If a profile defaults file changes after you have already built once, use a new
build directory or delete that profile's generated `sdkconfig`; an existing
`sdkconfig` can keep old menuconfig values.

The `server/` directory contains a lightweight local HTTP API for Web tooling:
`GET /api/profiles` returns screen profiles and `POST /api/build` builds the
selected firmware profile.

## Build and Flash

```bash
cd /Users/fengqihao/esp-idf
. ./export.sh
idf.py -C examples/peripherals/lcd/st7789_simple flash monitor
```

Replace `esp32s3` with the chip used by your development board.
