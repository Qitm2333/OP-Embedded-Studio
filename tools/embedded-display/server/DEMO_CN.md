# 无 Web 页面时的服务器演示流程

本文档用于在 Web 页面开发完成前，直接通过命令行模拟完整流程：

```text
选择屏幕 profile
服务器读取 profiles.json
服务器读取 defaults
服务器调用 ESP-IDF build
生成固件
烧录到开发板
```

## 准备条件

开发板：

```text
ESP32-S3 QFN56
Flash 8MB
PSRAM 8MB
```

当前屏幕 profile：

| profileId | 屏幕 | 驱动 IC | 配置 | 状态 |
| --- | --- | --- | --- | --- |
| `st7789_qs130tab1005a` | QS130TAB1005A 方屏 | ST7789 | 240x240, RGB, invert enabled | 已验证 |
| `st7735s_lb090r_if03` | LB090R-IF03 圆屏 | ST7735S | 128x128, BGR, invert enabled | 已验证 |
| `gc9d01n_gvh099wq010b_a0` | GVH099WQ010B-A0 0.99 英寸圆屏 | GC9D01N | 160x160, RGB, invert disabled | 待实物最终验证 |

已验证开发板串口：

```text
/dev/cu.usbmodem14101
```

如果串口不同，用下面命令查看：

```bash
ls /dev/cu.*
```

## 1. 启动服务器

打开第一个终端：

```bash
cd /Users/fengqihao/esp-idf
. ./export.sh
python3 examples/peripherals/lcd/st7789_simple/server/build_server.py
```

正常会看到：

```text
LCD profile build server listening on http://127.0.0.1:8765
Project directory: /Users/fengqihao/esp-idf/examples/peripherals/lcd/st7789_simple
```

这个终端保持打开，不要关闭。

## 2. 检查服务器是否在线

打开第二个终端：

```bash
curl http://127.0.0.1:8765/api/health
```

正常返回：

```json
{
  "ok": true,
  "projectDir": "/Users/fengqihao/esp-idf/examples/peripherals/lcd/st7789_simple"
}
```

## 3. 模拟 Web 页面读取屏幕列表

```bash
curl http://127.0.0.1:8765/api/profiles
```

这个接口会返回 `profiles.json` 的内容。Web 页面后续就是读取这个接口来展示：

```text
开发板信息
屏幕型号
驱动 IC
分辨率
接线表
背光说明
对应 defaults 文件
```

如果只想确认 profile id，可以执行：

```bash
curl http://127.0.0.1:8765/api/profiles | grep -E '"id":|"displayNameZh":|"defaultsFile":'
```

## 4. 模拟 Web 选择 ST7735S 圆屏并触发构建

```bash
curl -X POST http://127.0.0.1:8765/api/build \
  -H 'Content-Type: application/json' \
  -d '{"profileId":"st7735s_lb090r_if03"}'
```

服务器内部会执行等价于下面的命令：

```bash
idf.py -B build/profile_st7735s_lb090r_if03 \
  -DSDKCONFIG=build/profile_st7735s_lb090r_if03/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;screen_profiles/st7735s_lb090r_if03.defaults" \
  build
```

构建成功时返回里应包含：

```json
{
  "profileId": "st7735s_lb090r_if03",
  "ok": true,
  "returnCode": 0
}
```

并包含固件路径：

```text
build/profile_st7735s_lb090r_if03/st7789_simple.bin
build/profile_st7735s_lb090r_if03/bootloader/bootloader.bin
build/profile_st7735s_lb090r_if03/partition_table/partition-table.bin
build/profile_st7735s_lb090r_if03/flash_args
```

## 5. 确认生成的配置正确

```bash
grep -E "CONFIG_EXAMPLE_LCD_CONTROLLER|CONFIG_EXAMPLE_LCD_H_RES|CONFIG_EXAMPLE_LCD_V_RES|CONFIG_EXAMPLE_LCD_INVERT_COLOR|CONFIG_EXAMPLE_LCD_RGB_ORDER" \
examples/peripherals/lcd/st7789_simple/build/profile_st7735s_lb090r_if03/sdkconfig
```

ST7735S 正确结果应包含：

```text
# CONFIG_EXAMPLE_LCD_CONTROLLER_ST7789 is not set
CONFIG_EXAMPLE_LCD_CONTROLLER_ST7735=y
CONFIG_EXAMPLE_LCD_H_RES=128
CONFIG_EXAMPLE_LCD_V_RES=128
CONFIG_EXAMPLE_LCD_INVERT_COLOR=y
# CONFIG_EXAMPLE_LCD_RGB_ORDER_RGB is not set
CONFIG_EXAMPLE_LCD_RGB_ORDER_BGR=y
```

## 6. 烧录服务器生成的固件

```bash
idf.py -C examples/peripherals/lcd/st7789_simple \
  -B examples/peripherals/lcd/st7789_simple/build/profile_st7735s_lb090r_if03 \
  -p /dev/cu.usbmodem14101 flash
```

烧录成功时应看到：

```text
Connected to ESP32-S3
Writing bootloader/bootloader.bin ...
Writing partition_table/partition-table.bin ...
Writing st7789_simple.bin ...
Hash of data verified.
Hard resetting via RTS pin...
Done
```

## 7. 屏幕预期显示

ST7735S 圆屏应显示几何测试图：

```text
黑色背景
中心白色十字
灰色网格
左上红色
右上绿色
左下蓝色
右下黄色
```

因为这是圆屏，四角色块可能会被圆形可视区域裁掉，这是正常现象。

## 常见问题

### 串口被占用

如果烧录时报：

```text
Could not exclusively lock port
Resource temporarily unavailable
```

说明串口被 monitor、Python、串口助手或其他程序占用。先关闭占用串口的程序，再重新烧录。

可用下面命令查看占用者：

```bash
lsof /dev/cu.usbmodem14101
```

### 没有加载 ESP-IDF 环境

如果服务器构建接口返回找不到 `idf.py`，先停止服务器，然后重新执行：

```bash
cd /Users/fengqihao/esp-idf
. ./export.sh
python3 examples/peripherals/lcd/st7789_simple/server/build_server.py
```

### profile 修改后旧配置没有变化

ESP-IDF 可能保留旧 build 目录里的 `sdkconfig`。如果修改过 defaults，建议删除对应 build 目录后重新触发构建：

```bash
rm -rf examples/peripherals/lcd/st7789_simple/build/profile_st7735s_lb090r_if03
```

然后重新调用：

```bash
curl -X POST http://127.0.0.1:8765/api/build \
  -H 'Content-Type: application/json' \
  -d '{"profileId":"st7735s_lb090r_if03"}'
```
