# OpenPencil BLE Android Uploader

独立、无后端的 Android 图片上传器。应用内置静态 HTML 界面，原生 Java 层只负责：

- 按 OpenPencil Service UUID 扫描 BLE；
- 申请 Android 附近设备权限；
- 将网页生成的内容临时写入 App 缓存；
- 使用现有 offset + payload 分包协议上传到 ESP32。

支持当前 Waveshare 1.75C 的 `466 × 466` RGB565 单图和 20 FPS PNG 序列，内容上限为约 28.94 MiB。

## 构建

在仓库根目录运行：

```powershell
bun run mobile:apk
```

首次构建会把 JDK 17、Android Command-Line Tools、Android 35 SDK 和 Gradle 下载到仓库根目录的 `.android-portable/`。不安装 Android Studio，也不写系统环境变量。

生成文件：

```text
dist/android/OpenPencil-BLE-debug.apk
```

## 使用

1. 通过 USB 初始化支持 BLE 的 OpenPencil 基础固件。
2. 确保电脑端已经断开 BLE。
3. 在 Android 手机安装 APK，并允许“附近设备”权限。
4. 点击“连接 OpenPencil”，选择图片、裁切并上传。

应用不访问网络，图片处理和传输均在手机本地完成。
