# OP Embedded Studio

嵌入式 UI 设计、交互原型、固件烧录与无线传输平台。它将可视化设计画布与真实 ESP32 显示设备连接起来，让设计内容可以直接预览、烘焙、传输和烧录。

An embedded UI design, interaction prototyping, firmware flashing, and wireless content transfer platform. OP Embedded Studio connects a visual design canvas to real ESP32 display hardware so that interfaces can be previewed, baked, transferred, and flashed directly to a device.

> **项目来源与致谢：** 本项目最初基于 [OpenPencil](https://github.com/open-pencil/open-pencil) 开发。感谢 OpenPencil 原作者与社区提供优秀的开源设计编辑器基础，包括画布、文档格式、渲染、排版、AI、MCP 和 CLI 等能力。由于嵌入式设备、固件和传输链路相关改动较大，OP Embedded Studio 目前作为独立衍生项目维护，与 OpenPencil 官方项目不存在隶属关系。
>
> **Origin and acknowledgements:** This project was originally built on top of [OpenPencil](https://github.com/open-pencil/open-pencil). We sincerely thank the OpenPencil authors and community for the open-source editor foundation, including its canvas, document model, rendering, typography, AI, MCP, and CLI capabilities. Because OP Embedded Studio has diverged substantially around embedded hardware, firmware, and transfer workflows, it is now maintained as an independent derivative project and is not affiliated with or endorsed by the official OpenPencil project.

## 核心能力

- 在可视化画布中设计面向真实嵌入式屏幕的 Frame，也可以直接使用独立图片节点
- 使用 AI 设计模式结合文字和参考图创建或调整设备界面
- 使用 AI 烧录模式准备单画面烧录、手动浏览、幻灯片和自定义事件交互
- 将 Frame 或图片按目标分辨率烘焙为 RGB565 设备内容
- 在烧录前预览圆屏裁切、画面适配和多画面交互效果
- USB 自动检查设备固件；固件不兼容时自动更新，再继续传输当前内容
- 支持 USB、Wi-Fi、BLE 和 Wi-Fi 实时镜像
- 支持本地单图、PNG 序列，以及独立 Android BLE 图片上传器
- 保留 OpenPencil 的设计编辑、文档格式、MCP、CLI 和设计转代码基础能力

<p align="center">
  <img src="public/readme/ai-device-deployment.png" alt="OP Embedded Studio AI 交互烧录确认与设备预览" width="480" />
</p>

## What OP Embedded Studio Does

- **Design with visual AI context** — create or refine an embedded screen from text and pasted reference images.
- **Prepare device deployments with AI** — turn selected Frames or images into a single-screen deployment, manual gallery, slideshow, or custom event graph.
- **Preview before touching hardware** — inspect the target resolution, circular viewport, image placement, and interaction behavior from the Interaction panel or an AI confirmation card.
- **Deploy through one USB flow** — confirm the deployment and select the device once; Studio checks firmware compatibility, updates the base firmware when required, reconnects, and transfers the content.
- **Keep content updates fast** — compatible devices receive Frame, interaction, or sequence content without reflashing the application firmware.
- **Transfer over Wi-Fi or BLE** — initialize the matching wireless firmware once, then update content from Studio or the Android uploader.
- **Mirror a Frame in real time** — watch one Frame and send ordered updates over the dedicated Wi-Fi realtime channel.

## 从设计到设备

1. 在画布中创建 Frame，或拖入一张或多张图片。
2. 在“烧录”页签选择目标屏幕，并设置拉伸、等比缩放或不缩放。
3. 直接烧录单画面，或在交互栏 / AI 中创建多画面交互。
4. 在设备模拟器中检查目标比例、圆屏裁切、背景补边和事件跳转。
5. 确认烧录并选择 USB 设备。Studio 会检查固件兼容性，然后自动更新固件或直接传输内容。

AI 的“准备”和“预览”只生成主机侧内容，不会直接操作硬件；只有用户在确认卡片中执行烧录时，才会请求 USB 设备权限。

## AI 工作流

### AI 设计

- 选中目标 Frame 后描述需要创建或修改的界面
- 可以粘贴或拖入参考图片，让支持视觉输入的模型结合当前画布进行设计
- AI 修改仍写回可编辑画布，可以继续手动调整和撤销

### AI 烧录

- 根据当前选中的 Frame 或图片准备单画面烧录
- 将多个画面组织成手动浏览、幻灯片或自定义事件交互
- 在确认卡片中调整画面适配和背景色，并查看设备效果
- 在卡片中直接打开交互预览，确认后再选择设备和烧录
- 错误卡片会区分设备选择、串口占用、固件不兼容和内容失效等原因，并给出对应恢复操作

完成、取消或被新方案替代的卡片会折叠为历史记录，避免连续烧录时占满对话区域。

## 交互与设备模拟器

| 模式     | 行为                                               | 典型用途                         |
| -------- | -------------------------------------------------- | -------------------------------- |
| 手动浏览 | 为“下一张”和“上一张”选择设备事件，可设置首尾循环   | 图片浏览、菜单翻页、界面方案对比 |
| 幻灯片   | 按指定间隔自动切换画面，可在模拟器中暂停和重新开始 | 展示、轮播、动态信息屏           |
| 自定义   | 为每个画面的触屏与 BOOT 事件设置目标画面           | 菜单、流程原型、设备状态机       |

当前支持触屏单击、双击、三击、长按，以及 BOOT 单击和长按事件。交互栏和 AI 烧录卡片共用同一个设备模拟器，模拟器会使用当前设备分辨率、圆屏范围、画面适配和背景色。

## 画面适配

| 模式     | 说明                                                         |
| -------- | ------------------------------------------------------------ |
| 拉伸     | 将源画面完整拉伸到目标分辨率，可能改变宽高比                 |
| 等比缩放 | 保持宽高比完整显示，空白区域使用所选背景色                   |
| 不缩放   | 保持源像素尺寸并居中，超出设备区域时居中裁切，不足时补背景色 |

画面适配统一用于 USB、Wi-Fi、BLE、实时镜像、AI 单画面烧录和 AI 交互烧录。烧录确认卡与设备模拟器显示的是相同适配规则下的结果。

## 传输模式

| 模式           | 单画面 | 交互 | PNG 序列 | 说明                                                  |
| -------------- | -----: | ---: | -------: | ----------------------------------------------------- |
| USB            |     ✅ |   ✅ |       ✅ | 自动检查 USB 基础固件，不兼容时自动更新并继续传输内容 |
| Wi-Fi          |     ✅ |   ✅ |       ✅ | 首次通过 USB 初始化专用固件，后续无线传输内容         |
| BLE            |     ✅ |   ✅ |       ✅ | 支持浏览器 Web Bluetooth 与 Android BLE App           |
| Wi-Fi 实时镜像 |     ✅ |    — | 自动更新 | 固定一个 Frame，设计变化后按顺序同步到设备            |

不同模式拥有独立的状态、固件入口和传输适配器。切换模式不会复用其他模式的临时内容或连接状态。

## 基本工作流

### USB

1. 选择目标设备和一个 Frame / 图片；多选画面时也可以直接创建交互。
2. 设置画面适配，并在“烧录”页签或 AI 确认卡中准备内容。
3. 点击确认并选择 USB 设备。
4. Studio 检查设备是否支持当前 USB 内容协议。兼容时直接传输内容；不兼容时自动更新基础固件、等待设备重新连接，再继续传输内容。

正常使用不需要先进入单独的“初始化”步骤。只有设备维护、切换无线模式或底层固件开发时，才需要主动使用固件初始化入口。

### Wi-Fi / BLE

1. 在“首次使用与设备维护”中，通过 USB 烧录对应的预编译基础固件。
2. 连接设备创建的 Wi-Fi，或在浏览器/Android App 中连接 BLE 设备。
3. 选择单 Frame、状态机或 PNG 序列内容。
4. 无线上传，设备端显示传输与刷新状态。

### Wi-Fi 实时镜像

1. 烧录独立的 Realtime 固件。
2. 连接设备网络并选择一个固定 Frame。
3. 开始镜像；后续对该 Frame 的修改会按顺序烘焙并传输。

## 当前重点适配设备

目前完整适配 [Waveshare ESP32-S3-Touch-AMOLED-1.75C](https://docs.waveshare.net/ESP32-S3-Touch-AMOLED-1.75C)：

- 466 × 466 圆形 AMOLED 屏幕
- ESP32-S3 平台与 CO5300 显示控制器
- QSPI 显示接口、RGB565 映射和 TE 同步
- 圆形可视区域、居中裁切与背景补边
- BOOT 键与触屏交互输入

其他屏幕 profile 保留在设备目录中，便于继续扩展；当前默认设备和主要验证链路均为上述 Waveshare 屏幕。

## 当前限制

- 当前设备交互固件最多保存 10 个画面；提高上限需要评估并重新编译固件，而不是只修改前端限制。
- Web Serial 和 Web Bluetooth 需要支持相应硬件 API 的 Chromium 浏览器，建议使用最新版 Chrome 或 Edge。
- Wi-Fi、BLE 和实时镜像使用各自独立的基础固件，首次切换模式仍需要通过 USB 初始化对应固件。
- 其他屏幕 profile 尚未达到与 Waveshare ESP32-S3-Touch-AMOLED-1.75C 相同的完整验证程度。

## 本地运行

当前项目主要以源码方式开发和运行。

```sh
bun install
bun run dev
```

默认开发地址：

```text
http://localhost:1420
```

大部分常用设备 profile 与无线基础固件已作为静态资源随项目提供。只有新增屏幕、修改底层驱动或重新生成基础固件时，才需要使用嵌入式构建服务：

```sh
bun run embedded:server
```

## Android BLE App

项目包含一个独立、轻量的 Android BLE 图片上传器：

- 拍照或选择本地图片
- 圆形画布预览
- 双指缩放和拖动裁切
- 自动连接目标 BLE 设备并上传
- 无需运行完整的桌面编辑器

构建命令：

```sh
bun run mobile:apk
```

Android 工程位于 `tools/android-ble-uploader/`。

## 版本与发布

OP Embedded Studio 桌面端与 Android BLE 上传器独立维护版本：

| 产品                      | 标签格式         | 版本文件                                                        |
| ------------------------- | ---------------- | --------------------------------------------------------------- |
| OP Embedded Studio 桌面端 | `studio-vX.Y.Z`  | `package.json`、`desktop/tauri.conf.json`、`desktop/Cargo.toml` |
| Android BLE 上传器        | `android-vX.Y.Z` | `tools/android-ble-uploader/app/build.gradle`                   |

历史标签 `v0.3.5` 保留为 Android 上传器的旧版标签，后续不再使用无前缀的 `v*` 标签。桌面端自动更新已暂停，待项目建立自有签名密钥和更新清单后再恢复。

The desktop Studio and Android uploader use independent versions. Desktop releases use `studio-vX.Y.Z`; Android releases use `android-vX.Y.Z`. The inherited desktop updater is disabled until OP Embedded Studio has its own signing key and update manifest.

## 嵌入式模块结构

嵌入式能力尽量与上游编辑器保持解耦：

```text
src/app/ai/device/                       AI 设备意图、确认方案、错误恢复与烧录编排
src/features/device-prototype/           交互模式、状态规则、编辑面板与设备模拟器
src/features/embedded-display/           设备面板、内容转换与传输能力
  adapters/                              图片、USB、Wi-Fi、BLE 等适配层
  components/                            设备配置与烧录界面
  deployment/                            USB 部署计划与生命周期
  live-mirror/                           Wi-Fi 实时镜像
  model/                                 类型与领域模型
  runtime/                               设备目录与静态固件入口

tools/embedded-display/                  固件工程、构建服务与屏幕 profile
tools/embedded-display/prebuilt-firmware/  可直接调用的预编译固件资源
tools/android-ble-uploader/              独立 Android BLE 上传器
```

AI 方案、交互规则、设备 profile、内容转换和传输协议分别维护，避免把产品流程、设备实现和固件能力耦合在同一层。

## OpenPencil 基础能力

OP Embedded Studio 仍保留并使用大量 OpenPencil 能力，包括：

- `.fig` 与 `.pen` 文档读写
- CanvasKit / Skia 渲染
- Yoga 自动布局
- 组件、变量和图层编辑
- AI 设计助手
- MCP 与 CLI
- HTML、CSS、JSX 和 Tailwind 相关工作流

这些能力属于项目的编辑器基础，但本仓库的主要产品方向是嵌入式 UI 原型、设备预览与内容传输。OpenPencil 的原始用法和完整文档请访问其[官方仓库](https://github.com/open-pencil/open-pencil)。

## 开发检查

```sh
bun run check:vue
bun test tests/engine/app/device-prototype.test.ts
bun test tests/engine/app/embedded-display-ai-deployment.test.ts
bun test tests/engine/app/embedded-display-usb-firmware-flow.test.ts
bun test tests/engine/app/embedded-display-runtime.test.ts
bun run build
```

仓库不包含 OpenPencil 上游的大型 Git LFS 测试素材。相关说明见 `tests/fixtures/README.md`；这些测试素材不参与产品运行，也不影响中文字体 fallback。中文 fallback 优先使用系统字体，并可通过在线字体提供方加载和缓存 Noto Sans SC 等字体。

## Acknowledgements

- [OpenPencil](https://github.com/open-pencil/open-pencil) — the open-source editor foundation on which this project was originally built.
- The OpenPencil authors and contributors — for the canvas, renderer, document model, typography, AI, MCP, CLI, and the broader development work inherited by this repository.
- [Waveshare](https://www.waveshare.com/) — for the ESP32-S3-Touch-AMOLED-1.75C hardware and technical documentation used by the current primary device integration.
- [@sld0Ant](https://github.com/sld0Ant) — for creating and maintaining the original OpenPencil documentation site.

## License

This project is distributed under the MIT License. See `LICENSE` for details.

The original OpenPencil copyright and license notices are retained in accordance with the MIT License.
