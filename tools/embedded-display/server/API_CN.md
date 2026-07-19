# LCD 构建服务器接口文档

本文档是 LCD profile 构建流程的服务器接口契约，供后续服务器工程师替换、扩展或接入当前轻量 Python 服务器时参考。

相关文档：

- `HANDOFF_CN.md`：工程边界、数据流和后端交接说明
- `README_CN.md`：本地启动和快速使用
- `DEMO_CN.md`：命令行演示流程

## 基础地址

```text
http://127.0.0.1:8765
```

默认服务监听 `127.0.0.1`。可以通过参数修改：

```bash
python3 server/build_server.py --host 127.0.0.1 --port 8765
```

## 传输约定

- JSON 请求和响应使用 UTF-8。
- 固件二进制产物使用 `application/octet-stream`。
- 当前开发服务器会发送宽松 CORS 头：
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Methods: GET, POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`
- 当前实现对 `GET` 接口同时支持 `HEAD`。
- `OPTIONS` 返回 `204 No Content`。

## 响应结构

成功 JSON 响应包含：

```json
{
  "ok": true
}
```

错误响应使用同一结构：

```json
{
  "ok": false,
  "error": "可读错误信息"
}
```

构建失败比较特殊：`/api/build` 会返回带 `ok: false`、`returnCode`、`command` 和 `logTail` 的结构化构建结果，HTTP 状态码为 `500`。

## 限制

```text
RGB565 原始图片数据最大值：4 MiB
图片请求体字段长度最大值：6 MiB
最大帧数：120
App 分区大小：0x600000 字节，即 6 MiB
构建日志返回：最后 80 行
```

RGB565 字节序为小端。请求体使用 base64，所以请求体大小会大于原始 RGB565 数据。

## 接口总览

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

## 健康检查

### GET /api/health

检查服务器是否运行，并返回解析后的 example 项目目录。

响应示例：

```json
{
  "ok": true,
  "projectDir": "/Users/fengqihao/esp-idf/examples/peripherals/lcd/st7789_simple"
}
```

## 屏幕 Profile

### GET /api/profiles

返回 `screen_profiles/profiles.json` 的完整内容。

Web 页面使用这个响应来生成：

- 屏幕 profile 选择列表
- 接线图
- 分辨率和可视区域信息
- 图片载荷校验所需信息
- 构建请求里的 `profileId`
- 构建接口使用的 `defaultsFile`

服务器返回前会校验：

- 每个 profile 必须有非空 `id`。
- 每个 profile 必须有非空 `defaultsFile`。
- profile ID 不能重复。
- `defaults.base` 必须存在。
- 引用的 defaults 文件必须存在，且必须位于项目目录内。

重要字段：

```text
schemaVersion              注册表 schema 版本。
project                    example 项目路径，仅供 UI 和上下文使用。
board                      已验证开发板信息和通用 GPIO 提示。
defaults.base              所有 profile 共用的 sdkconfig defaults。
profiles[].id              API 请求使用的稳定 profile ID。
profiles[].displayName     英文显示名。
profiles[].displayNameZh   中文显示名。
profiles[].controller      LCD 控制器类型，例如 ST7789、ST7735 或 GC9D01N。
profiles[].logicalResolution
                           上传和构建要求的帧尺寸。
profiles[].visibleArea     实际屏幕形状和裁切说明。
profiles[].physicalSize    可选物理尺寸元数据，不影响像素缩放。
profiles[].defaultsFile    profile 专属 sdkconfig defaults。
profiles[].wiring          页面接线表数据。
profiles[].backlight       页面背光说明。
```

响应片段示例：

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

## 图片资源

### GET /api/image

返回当前生成图片头文件状态。

已存在图片时：

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

不存在图片时：

```json
{
  "ok": true,
  "image": {
    "exists": false
  }
}
```

### POST /api/image

上传已经处理好的图片帧。

浏览器负责完成这些工作，服务器不处理原始图片文件：

- 解码 PNG、JPG、BMP、WebP、GIF
- 对多文件序列帧做排序
- 应用适配模式、旋转、背景色、FPS 和抽帧策略
- 渲染预览帧
- 转换成 RGB565 小端字节

请求体：

```json
{
  "profileId": "st7735s_lb090r_if03",
  "name": "demo-sequence",
  "width": 128,
  "height": 128,
  "frameCount": 24,
  "frameDelayMs": 100,
  "pixelsRgb565Base64": "<RGB565 小端字节的 base64>"
}
```

字段说明：

```text
profileId             必填。必须匹配已知 profile。
name                  可选。会写入 LCD_GENERATED_IMAGE_NAME。
width                 必填整数。必须匹配 profile 逻辑宽度。
height                必填整数。必须匹配 profile 逻辑高度。
frameCount            可选整数，默认 1。范围 1 到 120。
frameDelayMs          可选整数，默认 1000。必须为正数。
pixelsRgb565Base64    必填。RGB565 小端字节流的 base64 字符串。
```

校验规则：

- `profileId` 必须匹配已知 profile。
- `width` 和 `height` 必须匹配 `profiles[].logicalResolution`。
- `frameCount` 必须在 1 到 120 之间。
- `frameDelayMs` 必须为正数。
- 解码后的字节长度必须等于 `width * height * 2 * frameCount`。
- 编码后的 payload 长度不能超过 6 MiB。
- 解码后的 RGB565 原始数据不能超过 4 MiB。

服务器会写入：

```text
main/generated_image_user.h
```

服务器还会 touch：

```text
main/generated_image.h
```

这是为了强制下一次增量构建重新编译 main 组件，确保新图片资源被编进固件。

响应示例：

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

删除 `main/generated_image_user.h`，并 touch `main/generated_image.h`。
下一次构建后固件会恢复显示内置几何测试图。

请求体会被忽略。

响应示例：

```json
{
  "ok": true,
  "image": {
    "exists": false
  }
}
```

## 固件构建

### POST /api/build

按指定屏幕 profile 构建固件。

请求体：

```json
{
  "profileId": "st7735s_lb090r_if03"
}
```

服务器会解析：

```text
screen_profiles/base.defaults
screen_profiles/<profile>.defaults
partitions_8mb_no_ota.csv
```

然后执行：

```bash
idf.py -B build/profile_<profileId> \
  -DSDKCONFIG=build/profile_<profileId>/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;<profile defaults>" \
  build
```

构建目录签名由以下输入计算：

- `screen_profiles/base.defaults`
- 所选 profile defaults 文件
- `partitions_8mb_no_ota.csv`

如果这些输入发生变化，服务器会删除并重建对应 profile build 目录，避免旧 `sdkconfig` 继续生效。源码变化由 ESP-IDF 正常增量构建处理，不参与这个签名。

当前 Python 实现使用进程内锁串行执行构建。它还没有持久化 job ID 或多用户构建队列。

成功响应示例：

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

构建失败响应示例：

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
    "构建输出最后 80 行"
  ]
}
```

如果找不到 `idf.py`，服务器会返回错误，提示启动服务器前需要先加载 ESP-IDF 环境。

## 浏览器烧录产物

### GET /api/artifacts/<profileId>/manifest.json

### GET /api/artifacts/<profileId>/manifest

返回 `esp-web-tools` 使用的固件清单。

profile 必须已知，并且所需固件产物必须都存在。如果还没有构建这个 profile，服务器会返回 `404`。

响应示例：

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

manifest 分段偏移：

```text
0x0000   bootloader.bin
0x8000   partition-table.bin
0x10000  st7789_simple.bin
```

### GET /api/artifacts/<profileId>/<file>

下载单个固件产物。

支持的文件名：

```text
bootloader.bin
partition-table.bin
st7789_simple.bin
```

服务器会把公开文件名映射到对应 profile build 目录：

```text
bootloader.bin       -> build/profile_<profileId>/bootloader/bootloader.bin
partition-table.bin  -> build/profile_<profileId>/partition_table/partition-table.bin
st7789_simple.bin    -> build/profile_<profileId>/st7789_simple.bin
```

未知文件名返回 `404`。产物路径解析会被限制在当前 profile build 目录内。

## 静态页面

当前服务器也负责提供本地 Web 页面：

```text
GET /             -> server/web/index.html
GET /index.html   -> server/web/index.html
GET /static/<file>
```

`/static/<file>` 会被限制在 `server/web/` 目录内，也可以服务类似 `server/web/vendor/esp-web-tools/` 这样的嵌套文件。

当前 `index.html` 刻意从 CDN 加载 `esp-web-tools`：

```text
https://cdn.jsdelivr.net/npm/esp-web-tools@10/dist/web/install-button.js
```

本地 vendor 文件仍保留在目录中，供后续继续处理离线化方案；但当前已验证的稳定烧录路径是 CDN 版。

如果后续前后端分离，这些静态接口可以交给普通静态资源服务。上面的 API 契约应尽量保持稳定。

## 常见状态码

```text
200 OK                  成功 JSON 或固件产物响应。
204 No Content          OPTIONS 预检响应。
400 Bad Request         JSON 无效、必填字段缺失、图片数据无效，或路径逃逸项目/Web 目录。
404 Not Found           未知 profile、未知接口、未知产物，或产物尚未构建。
500 Internal Server     profile/defaults 配置错误、构建失败、找不到 idf.py，或未预期服务器异常。
```
