# LCD 构建服务器交接文档

本文档面向后续接手、维护或重构当前 LCD profile 构建服务器的工程师。

建议配套阅读：

- `API_CN.md`：请求和响应契约
- `README_CN.md`：本地启动和快速使用
- `DEMO_CN.md`：无 Web 页面的命令行演示
- `../screen_profiles/README_CN.md`：profile 文件约定

## 当前状态

项目已经跑通完整闭环：

1. 在 Web 页面选择已验证的屏幕 profile。
2. 查看接线和图片资源设置。
3. 上传静态图片、GIF 或序列帧。
4. 浏览器把帧预处理成 RGB565。
5. 服务器写出生成图片头文件。
6. 服务器按所选 profile 构建固件。
7. 浏览器通过 Web Serial 烧录返回的 manifest。
8. 屏幕显示内置测试图或上传资源。

当前支持的 profile：

```text
st7789_qs130tab1005a   QS130TAB1005A 240x240 ST7789 方屏
st7735s_lb090r_if03    LB090R-IF03 128x128 ST7735S 圆屏
gc9d01n_gvh099wq010b_a0 GVH099WQ010B-A0 160x160 GC9D01N 0.99 英寸圆屏，待实物最终验证
```

当前阶段，后端工作应优先关注稳定性、可观测性和交接清晰度，而不是改变整体工作流。

## 负责范围

当前服务器主要负责四件事：

1. 向 Web 页面提供屏幕 profile 注册表。
2. 接收浏览器处理后的图片资源。
3. 按所选 profile 构建固件。
4. 以浏览器烧录可用的格式暴露构建产物。

当前服务器不负责：

- 在服务器端解析原始图片文件。
- 直接给开发板烧录。
- 用户、权限、会话、持久化。
- 持久化构建 job。
- 多用户并发队列。
- 保存历史上传资源或历史构建产物。

## 目录结构

```text
examples/peripherals/lcd/st7789_simple/
├── main/
│   ├── generated_image.h              # wrapper；存在 generated_image_user.h 时包含它
│   └── generated_image_user.h         # 生成文件，已 gitignore
├── screen_profiles/
│   ├── README.md
│   ├── README_CN.md
│   ├── profiles.json                  # /api/profiles 返回的 profile 注册表
│   ├── base.defaults                  # 共用 sdkconfig defaults
│   ├── st7789_qs130tab1005a.defaults
│   └── st7735s_lb090r_if03.defaults
├── partitions_8mb_no_ota.csv          # 单个 6 MiB app 分区
└── server/
    ├── build_server.py                # 当前 Python 参考实现
    ├── API_CN.md
    ├── HANDOFF_CN.md
    └── web/
        ├── index.html                 # 默认从 CDN 加载 esp-web-tools
        ├── app.js
        ├── styles.css
        └── vendor/esp-web-tools/      # 保留给后续离线/本地 flasher 工作
```

生成和构建期文件：

```text
main/generated_image_user.h
build/profile_<profileId>/
build/profile_<profileId>/.lcd_profile_build_signature
```

## 运行时数据流

### 1. 读取 Profile

浏览器调用：

```text
GET /api/profiles
```

服务器读取 `screen_profiles/profiles.json`，校验引用的 defaults 文件存在且位于项目目录内，然后返回注册表。

浏览器用这份数据生成：

- profile 选择器
- 分辨率信息
- 可视区域信息
- 接线图
- 背光说明
- 构建请求中的 `profileId`

### 2. 图片预处理

浏览器是图片处理端。

调用服务器前，浏览器会完成：

- 解码 PNG、JPG、BMP、WebP、GIF
- 拆分 GIF 多帧
- 对多文件序列帧做排序
- 应用适配模式
- 应用旋转
- 应用背景色
- 应用 FPS 和抽帧策略
- 预览处理后的帧
- 转换为 RGB565 小端字节

服务器只负责校验处理后的载荷，并写出生成 C 头文件。

这个边界很重要。把原始图片解析留在浏览器，可以避免服务器引入图片编解码器、大文件上传和持久化存储路径。

### 3. 生成图片头文件

浏览器发送：

```text
POST /api/image
```

服务器校验上传尺寸是否匹配所选 profile 的 `logicalResolution`，然后写入：

```text
main/generated_image_user.h
```

同时 touch：

```text
main/generated_image.h
```

touch 动作是必须的，这样 ESP-IDF 增量构建才会重新编译 main 组件，并包含最新图片内容。

`POST /api/image/clear` 会删除 `generated_image_user.h`，下一次构建后恢复内置几何测试图。

### 4. 构建固件

浏览器发送：

```text
POST /api/build
```

请求体中包含一个 `profileId`。

服务器随后会：

1. 读取 `profiles.json`。
2. 解析 `screen_profiles/base.defaults`。
3. 解析所选 profile 的 `defaultsFile`。
4. 使用 `partitions_8mb_no_ota.csv`。
5. 选择构建目录 `build/profile_<profileId>`。
6. 如果 defaults 或分区输入变化，则删除并重建这个 build 目录。
7. 执行 `idf.py build`。
8. 返回构建产物路径、app 大小信息和构建日志最后 80 行。

构建目录签名只覆盖 defaults 和分区表，不覆盖源码树。源码变化由 ESP-IDF 自己的依赖跟踪处理。

### 5. 浏览器烧录

服务器本身不烧录开发板。

浏览器通过：

```text
GET /api/artifacts/<profileId>/manifest.json
```

拿到 `esp-web-tools` 需要的 manifest，然后走浏览器串口烧录。

当前烧录布局：

```text
0x0000   bootloader.bin
0x8000   partition-table.bin
0x10000  st7789_simple.bin
```

## 浏览器职责和服务器职责

浏览器职责：

- 用户交互
- 图片预处理
- 图片预览和动画播放
- 屏幕选择
- 接线展示
- 浏览器串口烧录
- 面向用户的烧录提示和排障信息

服务器职责：

- profile 注册表校验和提供
- 已处理图片载荷校验
- 写入和清理生成头文件
- 组织固件构建
- defaults 和分区变化时让构建目录失效
- 构建产物路径解析
- 生成 manifest

这个边界是刻意设计的。它让服务器尽量无状态、轻量，同时让浏览器承担 UI 和图片编解码相关工作。

## Profile 体系

`screen_profiles/profiles.json` 是面向用户的 profile 注册表。每个 profile 指向一个 defaults 文件。构建时组合：

```text
screen_profiles/base.defaults
screen_profiles/<profile>.defaults
```

profile 元数据服务两类对象：

- Web UI：显示名、形状、接线、背光说明、分辨率
- 构建服务器：`id`、`defaultsFile`、`logicalResolution`

新增屏幕时，需要一起完成：

1. 新增 profile defaults 文件。
2. 在 `profiles.json` 增加条目。
3. 补接线和背光说明。
4. 验证 `/api/profiles`。
5. 通过 `/api/build` 构建。
6. 烧录并验证真实屏幕显示。

## 构建输入

当前一个 profile 的构建结果依赖于：

- `screen_profiles/base.defaults`
- `screen_profiles/<profile>.defaults`
- `partitions_8mb_no_ota.csv`
- `st7789_simple` 当前源码树
- 可选的 `main/generated_image_user.h`
- ESP-IDF 版本和当前环境

服务器假设启动环境里可以找到 `idf.py`。启动前应先执行：

```bash
. /Users/fengqihao/esp-idf/export.sh
```

## 构建产物契约

浏览器当前依赖这些构建输出：

- app binary
- bootloader binary
- partition table binary
- manifest JSON

构建响应还可能包含：

- `flashArgs`
- `flasherArgsJson`
- `sdkconfig`

这些额外路径主要用于调试。浏览器烧录当前使用 manifest 和三个二进制下载。

## 当前 Web 烧录状态

浏览器烧录当前默认使用 CDN 托管的 `esp-web-tools`：

```text
https://cdn.jsdelivr.net/npm/esp-web-tools@10/dist/web/install-button.js
```

原因是：

- 本地 vendor 版本已经尝试过。
- `Connect` 按钮本身可以显示。
- 但真实设备烧录初始化阶段在本地模式下不稳定。
- 同一块板子上，CDN 版本已经验证可正常烧录。

因此当前优先保证“能稳定烧录”，而不是“完全离线化”。

本地 vendor 副本仍保留在：

```text
server/web/vendor/esp-web-tools/
```

本地 flasher 修复应作为单独后续任务处理，不应阻塞服务器 API 交接。

## 当前运行约束

### 开发板假设

当前 defaults 针对的是已经验证过的开发板：

- ESP32-S3
- 8 MiB Flash
- 测试板带 8 MiB PSRAM
- 不带 OTA 分区
- 单个 6 MiB factory app 分区

如果后续开发板变化，需要同步调整：

- 分区表
- 共用 defaults
- profile defaults
- profile 注册表里的 board 元数据
- 如果 SoC 系列变化，还要调整 manifest chip family

### 构建隔离

每个 profile 使用独立 build 目录：

```text
build/profile_<profileId>
```

这样可以避免不同屏幕类型之间的 `sdkconfig` 相互污染。

### 并发能力

当前 Python 服务器使用 `ThreadingHTTPServer`，但构建执行由一个进程内锁保护。

这对本地单用户开发足够，但不适合作为共享服务。生产化后端应增加：

- 持久化 job ID
- 构建队列
- 每个 job 或每个用户独立工作目录
- 构建取消能力
- 构建产物保留策略
- 日志流式输出或轮询

### 状态隔离

当前服务器只有一个全局生成图片头文件：

```text
main/generated_image_user.h
```

这意味着两个用户构建不同图片时会相互覆盖。多用户后端必须按 job 或 workspace 隔离生成资源。

## 已知失败点

构建侧失败：

- 启动服务器前没有加载 ESP-IDF 环境。
- profile 引用了不存在的 defaults 文件。
- defaults 改过后，旧 build 目录里保留了过时 `sdkconfig`。
- 生成图片数据导致 app binary 过大。
- ESP-IDF 依赖或源码错误出现在 `logTail` 中。

烧录侧失败：

- 浏览器不支持 Web Serial。
- 串口已被其他程序占用。
- ESP32-S3 没有进入下载/bootloader 模式。
- USB 线或开发板供电不稳定。
- 在本地 vendor `esp-web-tools` 未修复前切回了本地路径。

下一步 UI 稳定性任务应把这些情况拆成明确的用户排障卡片。

## 建议的后端重构方向

如果后续要把当前轻量 Python 服务器替换成完整后端，建议保留以下边界：

1. 保留 `/api/profiles` 作为 profile 注册表来源。
2. 保留 `/api/image` 接收“浏览器处理后的 RGB565”，不要改成上传原始图片。
3. 保留 `/api/build` 的“一次构建一个 profile”模型。
4. 保留 `/api/artifacts/<profileId>/manifest.json` 供浏览器烧录使用。
5. 除非分区布局变化，否则保留 manifest 产物路径和 offset。

未来后端可以安全新增：

- job ID
- 异步构建状态查询
- 构建日志流式输出
- 构建历史
- 产物过期清理
- 权限控制
- 持久化 profile 管理
- 服务器端 profile 完整性校验报告

而不破坏当前浏览器工作流。

## 建议的后端后续任务

1. 把构建执行抽象成明确的 job 对象。
2. 提供结构化构建日志，而不只是 log tail。
3. 增加稳定字段的 artifact 元数据接口。
4. 增加 profile 完整性校验报告。
5. 增加部署文档，而不只是本地开发文档。
6. 在开放到 localhost 之外前，先补多用户隔离。

## 交接总结

最稳妥的接手方式，是保留已经跑通的工作流，在同一套 API 后面逐步增强后端：

```text
选 profile -> 浏览器预处理图片 -> 上传处理后的帧 ->
构建固件 -> 提供 manifest -> 浏览器串口烧录
```

不要一上来重画浏览器和服务器边界。当前边界已经通过真实屏幕和真实烧录验证。
