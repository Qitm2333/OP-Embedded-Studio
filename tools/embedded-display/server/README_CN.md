# LCD Profile 构建服务器

这个轻量服务器用于给 Web 端提供 profile 列表和固件构建接口。它只使用 Python 标准库，不需要额外安装依赖。

## 启动方式

先加载 ESP-IDF 环境，然后启动服务：

```bash
. /Users/fengqihao/esp-idf/export.sh
python3 /Users/fengqihao/esp-idf/examples/peripherals/lcd/st7789_simple/server/build_server.py
```

默认地址：

```text
http://127.0.0.1:8765
```

用 Chrome 或 Edge 打开这个地址即可使用本地 Web 页面。页面可以选择 profile、调用构建接口，并通过 `esp-web-tools` 启动 Web Serial 烧录。

服务器接口契约请看 `API_CN.md`。
如果是后续接手服务器开发，请同时阅读 `HANDOFF_CN.md`。

## 接口

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

构建请求示例：

```json
{
  "profileId": "st7735s_lb090r_if03"
}
```

服务器会读取 `screen_profiles/profiles.json`，根据 `profileId` 找到对应的 `defaultsFile`，然后执行：

```bash
idf.py -B build/profile_<profileId> \
  -DSDKCONFIG=build/profile_<profileId>/sdkconfig \
  -DSDKCONFIG_DEFAULTS="screen_profiles/base.defaults;<屏幕 defaults>" \
  build
```

返回内容包含构建命令、返回码、日志尾部，以及生成固件的路径。

## 图片资源

Web 页面可以在构建前上传图片资源。当前支持：

- 单张静态 `PNG` / `JPG` / `BMP` / `WebP`
- 单个 `GIF` 动图
- 多张静态图片作为序列帧，常见用法是多张按编号命名的 `PNG`

浏览器会把 GIF 拆成多帧；如果选择了多张静态图片，则按文件名自然排序作为
序列帧。随后浏览器会对每一帧应用页面中选择的适配模式，转换成 RGB565，再发送给服务器：

上传前，页面会把处理后的帧绘制到 Canvas 预览区。可以用播放/暂停检查动画节奏，
也可以用上一帧/下一帧检查序列顺序和图片适配效果。
页面还会预估 RGB565 资源大小、资源余量，以及当前屏幕配置下理论最多可用帧数。
构建完成后，页面会显示 app 固件大小和 6 MiB app 分区剩余空间。

```text
POST /api/image
```

请求体示例：

```json
{
  "profileId": "st7735s_lb090r_if03",
  "name": "photo.png",
  "width": 128,
  "height": 128,
  "frameCount": 1,
  "frameDelayMs": 100,
  "pixelsRgb565Base64": "<RGB565 小端字节的 base64>"
}
```

服务器会生成 `main/generated_image_user.h`，这个文件已被 git 忽略。下一次
Build 时，这些图片帧会被编进固件。静态图片会作为 1 帧显示；GIF 或序列帧会按
页面选择的帧率循环播放；如果没有上传图片，固件会显示默认几何测试图。

服务器最多接受 120 帧，RGB565 原始帧数据最多 4 MiB。如果固件体积接近分区上限，
需要减少帧数或降低动画帧率。

公共 profile defaults 使用 `partitions_8mb_no_ota.csv`，会在已验证的 8MB
ESP32-S3 开发板上提供单个 6 MiB factory app 分区，不包含 OTA 分区。

GIF 拆帧库会在浏览器选择 GIF 时按需从 CDN 加载。单张静态图和多张图片序列帧
不依赖这个解析库。

如果要恢复默认几何测试图，可以调用：

```text
POST /api/image/clear
```

构建成功后，manifest 接口会返回浏览器烧录需要的固件分段：

```text
0x0000   bootloader.bin
0x8000   partition-table.bin
0x10000  st7789_simple.bin
```

## 快速测试

```bash
python3 server/build_server.py --check
curl http://127.0.0.1:8765/api/profiles
curl -X POST http://127.0.0.1:8765/api/build \
  -H 'Content-Type: application/json' \
  -d '{"profileId":"st7735s_lb090r_if03"}'
```

如果要在没有 Web 页面时演示完整流程，请看 `DEMO_CN.md`。
