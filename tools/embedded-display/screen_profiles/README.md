# LCD Screen Profiles

This directory contains the profile system used by the ST7789 simple example.
It separates board-wide settings from screen-specific settings so a server or
automation script can select a verified LCD module without interactive
`menuconfig`.

## Files

| File | Purpose |
| --- | --- |
| `profiles.json` | Structured profile registry for Web UI, wiring hints, and server-side build selection. |
| `base.defaults` | Common ESP32-S3 board settings and shared GPIO assignment. |
| `st7789_qs130tab1005a.defaults` | Verified settings for the QS130TAB1005A 240x240 ST7789 screen. |
| `st7735s_lb090r_if03.defaults` | Verified settings for the LB090R-IF03 128x128 ST7735S round screen. |
| `gc9d01n_gvh099wq010b_a0.defaults` | Settings for the GVH099WQ010B-A0 160x160 GC9D01N 0.99-inch round screen, pending final hardware verification. |

## Server-Side Build Flow

Use the selected profile id from `profiles.json`, then combine
`base.defaults` with that profile's `defaultsFile`.

Example for ST7789:

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7789 \
  -DSDKCONFIG=build/profile_st7789/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7789_qs130tab1005a.defaults" \
  build
```

Example for ST7735S:

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7735s \
  -DSDKCONFIG=build/profile_st7735s/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7735s_lb090r_if03.defaults" \
  build
```

Example for GC9D01N:

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_gc9d01n_gvh099wq010b_a0 \
  -DSDKCONFIG=build/profile_gc9d01n_gvh099wq010b_a0/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/gc9d01n_gvh099wq010b_a0.defaults" \
  build
```

Use a separate build directory and `SDKCONFIG` path for each profile. This
prevents one selected screen from overwriting another profile's generated
`sdkconfig`.

When a profile defaults file changes, build with a fresh directory or delete the
old generated `sdkconfig` for that profile. ESP-IDF may keep existing
`sdkconfig` values and not replace them from defaults.

## Wiring Data

The Web UI should read the `wiring` array in `profiles.json` for the selected
profile and display it before firmware build or flashing. The defaults files
only configure firmware; they do not describe physical wiring.

Round-screen profiles still use a square logical pixel frame, such as
`160 x 160` for GVH099WQ010B-A0. The `physicalSize` metadata records spec-sheet
dimensions such as the 0.99-inch diagonal and `23.1 x 23.1 mm` active area; it
does not change firmware pixel scaling.
