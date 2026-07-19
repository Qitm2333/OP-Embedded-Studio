# LCD 屏幕 Profile 说明

这个目录用于记录 `st7789_simple` 示例工程的屏幕 profile 体系。它把开发板公共配置和屏幕专属配置拆开，后续服务器或脚本就可以根据 Web 端选择的屏幕型号直接编译，不需要人工进入 `menuconfig`。

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `profiles.json` | 结构化的屏幕配置注册表，给 Web 端展示型号、接线提示、背光注意事项，也给服务器选择 defaults 使用。 |
| `base.defaults` | ESP32-S3 开发板公共配置，以及各屏幕共用的 GPIO 分配。 |
| `st7789_qs130tab1005a.defaults` | QS130TAB1005A 240x240 ST7789 方屏的已验证配置。 |
| `st7735s_lb090r_if03.defaults` | LB090R-IF03 128x128 ST7735S 圆屏的已验证配置，颜色顺序为 BGR。 |
| `gc9d01n_gvh099wq010b_a0.defaults` | GVH099WQ010B-A0 160x160 GC9D01N 0.99 英寸圆屏配置，待实物最终验证。 |

## 服务器编译流程

服务器收到 Web 端选择的 profile id 后，读取 `profiles.json`，把 `base.defaults` 和对应 profile 的 `defaultsFile` 一起传给 ESP-IDF 编译。

ST7789 示例：

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7789 \
  -DSDKCONFIG=build/profile_st7789/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7789_qs130tab1005a.defaults" \
  build
```

ST7735S 示例：

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7735s \
  -DSDKCONFIG=build/profile_st7735s/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7735s_lb090r_if03.defaults" \
  build
```

GC9D01N 示例：

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_gc9d01n_gvh099wq010b_a0 \
  -DSDKCONFIG=build/profile_gc9d01n_gvh099wq010b_a0/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/gc9d01n_gvh099wq010b_a0.defaults" \
  build
```

建议每个 profile 使用独立的 build 目录和独立的 `SDKCONFIG` 路径，避免不同屏幕的配置互相覆盖。

如果 profile defaults 文件修改过，建议使用新的 build 目录，或者删除旧的生成文件 `sdkconfig` 后再编译。ESP-IDF 可能会保留已有 `sdkconfig` 的配置值，不一定自动从 defaults 覆盖。

## 接线提示

Web 端应该读取 `profiles.json` 中当前 profile 的 `wiring` 数组，然后把 FPC 引脚、信号名、开发板 GPIO 和备注展示给用户。defaults 文件只负责固件配置，不负责描述物理接线。

圆屏 profile 的 `logicalResolution` 仍然是方形像素帧，例如 GVH099WQ010B-A0 是 `160 x 160`。`physicalSize` 只记录规格书里的物理尺寸，例如 0.99 英寸和 `23.1 x 23.1 mm` active area，不参与固件像素缩放。
