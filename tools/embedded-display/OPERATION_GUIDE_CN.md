# LCD 调试操作指引

本文档记录本工程当前支持的 ESP32-S3 开发板信息、屏幕类型、驱动芯片型号、接线方式和 profile 编译方式。

## 开发板

```text
MCU                 ESP32-S3
封装                QFN56
Flash              8 MB
PSRAM              8 MB embedded PSRAM
CPU                双核，240 MHz
工程 target         esp32s3
```

ESP32-S3 使用 USB 下载或调试时，LCD 信号建议避开 GPIO19 和 GPIO20，因为它们常用于原生 USB D-/D+。

## 支持的屏幕

| 屏幕 | 模组 / 规格书 | 驱动芯片 | 分辨率 | 接口 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 方屏 | QS130TAB1005A | ST7789P3-G5 / ST7789 兼容 | 240 x 240 | 4-wire SPI | 已验证 |
| 圆屏 | LB090R-IF03 | ST7735S | 128 x 128 | 4-wire SPI | 已验证 |
| 圆屏 | GVH099WQ010B-A0 | GC9D01N | 160 x 160 | 4-wire SPI | 待实物最终验证 |

## 公共 GPIO 分配

这些屏幕当前使用同一套 ESP32-S3 GPIO：

| LCD 信号 | ESP32-S3 GPIO | 说明 |
| --- | --- | --- |
| SCLK / SCL | GPIO12 | SPI 时钟 |
| SDA / MOSI | GPIO11 | SPI 数据输出到 LCD |
| DC / RS / D/C | GPIO9 | 数据/命令选择 |
| RESET | GPIO14 | 复位 |
| CS | GPIO10 | SPI 片选 |
| GND | GND | 共地 |
| VDD | 3V3 | 屏幕逻辑电源 |

MISO 不使用，在配置中保持为 `-1`。

## QS130TAB1005A ST7789 方屏接线

| FPC 引脚 | 信号 | 连接到 |
| --- | --- | --- |
| Pin 1 | SDA | GPIO11 |
| Pin 2 | SCL | GPIO12 |
| Pin 3 | RS | GPIO9 |
| Pin 4 | RESET | GPIO14 |
| Pin 5 | CS | GPIO10 |
| Pin 6 | GND | GND |
| Pin 7 | VDD | 3V3 |
| Pin 8 | LEDK | 背光负极 |
| Pin 9 | LEDA | 背光正极 |
| Pin 10 | GND | GND |

已验证软件配置：

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

## LB090R-IF03 ST7735S 圆屏接线

| FPC 引脚 | 信号 | 连接到 |
| --- | --- | --- |
| Pin 1 | GND | GND |
| Pin 2 | VDD | 3V3 |
| Pin 3 | SCLK | GPIO12 |
| Pin 4 | TE | 不接 |
| Pin 5 | RESET | GPIO14 |
| Pin 6 | CS | GPIO10 |
| Pin 7 | SDA | GPIO11 |
| Pin 8 | D/C | GPIO9 |
| Pin 9 | LEDK | 背光负极 |
| Pin 10 | LEDA | 背光正极 |

已验证软件配置：

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

LB090R-IF03 的可见区域是 128 x 128 逻辑画面内的圆形区域，四角被圆形显示区域裁掉属于正常现象。规格书中背光为 3 颗白光 LED，约 `2.9V~3.1V`，典型电流 `60mA`，建议使用恒流背光驱动，不要直接用 ESP32 GPIO 驱动背光。

## GVH099WQ010B-A0 GC9D01N 0.99 英寸圆屏接线

| FPC 引脚 | 信号 | 连接到 |
| --- | --- | --- |
| Pin 1 | GND | GND |
| Pin 2 | SDA | GPIO11 |
| Pin 3 | SCL | GPIO12 |
| Pin 4 | RS | GPIO9 |
| Pin 5 | RESET | GPIO14 |
| Pin 6 | CS | GPIO10 |
| Pin 7 | VCC | 3V3 |
| Pin 8 | LEDK | 背光负极 |
| Pin 9 | LEDA | 背光正极 |
| Pin 10 | GND | GND |

当前软件配置：

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

GVH099WQ010B-A0 的规格书标注为 0.99 英寸圆形可视区，active area 为 `23.1 x 23.1 mm`，逻辑画面为 `160 x 160`。固件按 160 x 160 像素写屏，0.99 英寸只作为物理尺寸元数据，不参与像素缩放。规格书中背光为 2 颗白光 LED，约 `2.8V~3.2V`，典型电流 `40mA`。

## Profile 和 defaults

本工程已把屏幕配置落到 `screen_profiles/` 目录：

| Profile ID | defaults 文件 | 用途 |
| --- | --- | --- |
| `st7789_qs130tab1005a` | `screen_profiles/st7789_qs130tab1005a.defaults` | QS130TAB1005A 方屏 |
| `st7735s_lb090r_if03` | `screen_profiles/st7735s_lb090r_if03.defaults` | LB090R-IF03 圆屏 |
| `gc9d01n_gvh099wq010b_a0` | `screen_profiles/gc9d01n_gvh099wq010b_a0.defaults` | GVH099WQ010B-A0 0.99 英寸圆屏 |

`screen_profiles/base.defaults` 保存开发板公共配置和 GPIO 分配。服务器编译时应把 `base.defaults` 和用户选择的屏幕 defaults 一起传给 ESP-IDF。

ST7789 编译示例：

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7789 \
  -DSDKCONFIG=build/profile_st7789/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7789_qs130tab1005a.defaults" \
  build
```

ST7735S 编译示例：

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7735s \
  -DSDKCONFIG=build/profile_st7735s/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7735s_lb090r_if03.defaults" \
  build
```

GC9D01N 编译示例：

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_gc9d01n_gvh099wq010b_a0 \
  -DSDKCONFIG=build/profile_gc9d01n_gvh099wq010b_a0/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/gc9d01n_gvh099wq010b_a0.defaults" \
  build
```

如果某个 profile 的 defaults 修改过，而对应 build 目录之前已经编译过，建议换一个新的 build 目录，或者删除该 profile 生成出来的 `sdkconfig`。ESP-IDF 可能会保留旧 `sdkconfig` 里的 menuconfig 值，不一定自动用新的 defaults 覆盖。

Web 端显示接线提示时，应读取 `screen_profiles/profiles.json` 中对应 profile 的 `wiring` 数组。defaults 只负责固件配置，不负责描述物理接线。

## 烧录后的显示效果

固件会显示几何测试图：

```text
黑色背景
白色 1 像素边框
灰色网格线
左上角红色标记
右上角绿色标记
左下角蓝色标记
右下角黄色标记
中心白色十字
```

坐标方向：

```text
红色 -> 绿色   X 正方向，从左到右
红色 -> 蓝色   Y 正方向，从上到下
红色标记       接近逻辑原点 (0, 0)
黄色标记       接近逻辑右下角
```
