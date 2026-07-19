# Windows 搭建 Web 固件生成服务操作指引

本文档用于在 Windows 电脑上运行本项目的本地 Web 服务，完成 LCD profile 选择、图片上传、固件生成和浏览器烧录。

## 1. 适用环境

推荐环境：

```text
系统        Windows 10 / Windows 11
ESP-IDF     D:\esp-idf
Python      Python 3.11.x
项目目录    D:\esp-idf\examples\peripherals\lcd\st7789_simple
浏览器      Chrome / Edge
```

本项目当前验证过的 ESP-IDF 路径示例：

```text
D:\esp-idf
```

如果你的 ESP-IDF 装在其他目录，需要把下面命令中的 `D:\esp-idf` 替换成实际路径。

## 2. 必要代码适配

Windows 下需要注意两个地方。

### 2.1 服务端不要直接依赖 PATH 里的 idf.py

Windows 环境里可能同时存在：

```text
C:\Users\ASUS\.espressif\tools\idf-exe\1.0.3\idf.py.exe
D:\esp-idf\tools\idf.py
```

执行：

```powershell
idf.py --version
```

可能会优先命中 `idf.py.exe`，显示：

```text
v1.0.3
```

这不是 ESP-IDF 本体版本。正确验证方式是：

```powershell
python D:\esp-idf\tools\idf.py --version
```

正常输出类似：

```text
ESP-IDF v6.0.1-722-gf82a0593e0-dirty
```

服务端构建时应明确调用：

```text
call D:\esp-idf\export.bat && python D:\esp-idf\tools\idf.py build
```

不要只执行 PATH 里的 `idf.py`。

### 2.2 CMake 中的 IDF_PATH 要转换为正斜杠

Windows 下 `$ENV{IDF_PATH}` 会展开成：

```text
D:\esp-idf
```

如果直接传给 CMake，可能出现：

```text
Invalid character escape '\e'
```

`main/CMakeLists.txt` 中应使用：

```cmake
file(TO_CMAKE_PATH "$ENV{IDF_PATH}" IDF_PATH_CMAKE)

idf_component_register(SRCS "st7789_simple_main.c" "lcd_panel_factory.c" "st7735_panel.c" "gc9d01n_panel.c"
                       INCLUDE_DIRS "."
                       PRIV_INCLUDE_DIRS "${IDF_PATH_CMAKE}/components/esp_lcd/interface"
                       REQUIRES esp_lcd esp_driver_gpio esp_driver_spi)
```

## 3. 准备 Python

ESP-IDF v6 需要 Python 3.10 或更新版本，推荐 Python 3.11。

检查 Python 3.11：

```powershell
& "C:\Users\ASUS\AppData\Local\Programs\Python\Python311\python.exe" --version
```

正常输出：

```text
Python 3.11.4
```

不要使用 Python 3.8，例如：

```text
D:\Actions\ZEPHYR_SDK\1.02\Python38\python.exe
```

它不满足 ESP-IDF v6 的版本要求。

## 4. 准备 ESP-IDF 工具环境

建议把 `IDF_TOOLS_PATH` 指向当前用户的 `.espressif` 目录：

```powershell
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
```

如果系统里曾经有错误路径，例如：

```text
IDF_TOOLS_PATH=D:\esp531\Espressif
```

可以在当前 PowerShell 里临时覆盖：

```powershell
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
```

如需永久修改：

```powershell
setx IDF_TOOLS_PATH "%USERPROFILE%\.espressif"
```

执行 `setx` 后需要重新打开终端。

## 5. 加载 ESP-IDF 环境

PowerShell 推荐使用：

```powershell
cd D:\esp-idf
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
$env:PATH="C:\Users\ASUS\AppData\Local\Programs\Python\Python311;$env:PATH"
.\export.ps1
```

验证：

```powershell
python D:\esp-idf\tools\idf.py --version
```

如果必须用 CMD，则使用：

```bat
cd /d D:\esp-idf
set IDF_TOOLS_PATH=%USERPROFILE%\.espressif
set PATH=C:\Users\ASUS\AppData\Local\Programs\Python\Python311;%PATH%
export.bat
python D:\esp-idf\tools\idf.py --version
```

## 6. 补齐 ESP-IDF 子模块

如果构建时报类似错误：

```text
Include directory 'D:/esp-idf/components/mbedtls/mbedtls/include' is not a directory.
```

说明 ESP-IDF 子模块不完整。至少需要补齐对应子模块：

```powershell
cd D:\esp-idf
git submodule update --init --recursive components/mbedtls/mbedtls
```

如果多个组件都缺失，网络稳定时可以执行完整更新：

```powershell
cd D:\esp-idf
git submodule update --init --recursive
```

如果 Git for Windows 报找不到 `basename`、`sed`、`git-sh-setup`，先把 Git 的 `cmd` 和 `usr\bin` 放到 PATH 前面：

```powershell
$env:PATH="D:\Program Files\Git\cmd;D:\Program Files\Git\usr\bin;$env:PATH"
```

## 7. 启动 Web 服务

进入项目目录：

```powershell
cd D:\esp-idf\examples\peripherals\lcd\st7789_simple
```

推荐用 Python 3.11 明确启动：

```powershell
& "C:\Users\ASUS\AppData\Local\Programs\Python\Python311\python.exe" server\build_server.py
```

默认地址：

```text
http://127.0.0.1:8765
```

用 Chrome 或 Edge 打开该地址。

### 7.1 使用启动脚本

项目根目录提供了 Windows 启动脚本：

```text
start_windows_server.ps1
```

在 PowerShell 中进入项目目录后执行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start_windows_server.ps1
```

脚本会自动：

- 从当前项目目录向上查找 ESP-IDF 根目录。
- 优先查找 Python 3.10 到 3.13。
- 设置 `IDF_TOOLS_PATH`。
- 执行 `<idf-path>\export.ps1` 加载 ESP-IDF 环境。
- 验证 `python <idf-path>\tools\idf.py --version`，并确认输出是 `ESP-IDF v...`。
- 使用 ESP-IDF 虚拟环境里的 Python 启动 `server\build_server.py`。

如果 ESP-IDF 或 Python 不在默认位置，可以显式指定：

```powershell
.\start_windows_server.ps1 `
  -IdfPath "D:\esp-idf" `
  -PythonExe "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
```

如果需要换端口：

```powershell
.\start_windows_server.ps1 -Port 8766
```

如果只想检查环境，不启动服务：

```powershell
.\start_windows_server.ps1 -CheckOnly
```

## 8. 生成固件

在页面中：

1. 选择屏幕 profile。
2. 可选：上传图片、GIF 或序列帧。
3. 点击“生成固件”。

第一次全量构建会比较久。构建成功后会生成：

```text
build/profile_<profileId>/st7789_simple.bin
build/profile_<profileId>/bootloader/bootloader.bin
build/profile_<profileId>/partition_table/partition-table.bin
```

也可以直接用接口验证：

```text
GET http://127.0.0.1:8765/api/artifacts/<profileId>/manifest.json
```

例如：

```text
http://127.0.0.1:8765/api/artifacts/st7789_qs130tab1005a/manifest.json
```

## 9. 浏览器烧录

页面中点击 `Connect` / `Install` 后选择开发板串口。

如果提示：

```text
Failed to initialize. Try resetting your device or holding the BOOT button while clicking INSTALL.
```

说明开发板没有进入下载模式。处理方式：

1. 按住开发板 `BOOT` 键。
2. 点击页面 `INSTALL`。
3. 选择正确串口。
4. 连接开始后松开 `BOOT`。

如果仍失败，手动进下载模式：

1. 按住 `BOOT`。
2. 点一下 `RESET` / `EN`。
3. 松开 `RESET` / `EN`。
4. 松开 `BOOT`。
5. 回到页面重新点击 `INSTALL`。

如果使用 ESP32-S3 原生 USB，LCD 信号建议避开 GPIO19 和 GPIO20，因为它们常用于 USB D- / D+。

## 10. 常见问题

### 10.1 页面显示“生成失败：请求失败：500”

先看服务端构建日志或直接请求 `/api/build`。常见原因：

- `IDF_PATH` Windows 反斜杠导致 CMake 报 `Invalid character escape '\e'`。
- ESP-IDF 子模块缺失，例如 `mbedtls`。
- Python 版本过低。
- PATH 中命中了错误的 `idf.py.exe`。

### 10.2 `idf.py --version` 显示 `v1.0.3`

这是 `.espressif\tools\idf-exe` 启动器版本，不是 ESP-IDF 本体版本。

用下面命令验证 ESP-IDF：

```powershell
python D:\esp-idf\tools\idf.py --version
```

### 10.3 PowerShell 中找不到 `idf.py`

PowerShell 中需要执行：

```powershell
cd D:\esp-idf
.\export.ps1
```

或者直接使用完整路径：

```powershell
python D:\esp-idf\tools\idf.py --version
```

### 10.4 构建提示 Python 3.8 不支持

说明 PATH 里优先找到了旧 Python。临时修正：

```powershell
$env:PATH="C:\Users\ASUS\AppData\Local\Programs\Python\Python311;$env:PATH"
```

然后重新运行 `export.ps1` 或重启服务端。

### 10.5 首次构建很慢或请求超时

第一次构建会生成完整 build 目录，可能超过浏览器或脚本默认等待时间。等待服务端终端完成后，再点击一次“生成固件”，增量构建通常会快很多。

## 11. 快速命令汇总

```powershell
cd D:\esp-idf
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
$env:PATH="C:\Users\ASUS\AppData\Local\Programs\Python\Python311;$env:PATH"
.\export.ps1
python D:\esp-idf\tools\idf.py --version

cd D:\esp-idf\examples\peripherals\lcd\st7789_simple
& "C:\Users\ASUS\AppData\Local\Programs\Python\Python311\python.exe" server\build_server.py
```

浏览器打开：

```text
http://127.0.0.1:8765
```

## 12. 另一台 Windows 电脑部署

换到另一台 Windows 电脑时，通常不需要改业务代码，主要确认路径和 ESP-IDF 环境。

### 12.1 需要带过去的文件

至少带过去这些改动：

```text
server/build_server.py
main/CMakeLists.txt
start_windows_server.ps1
WINDOWS_SETUP_CN.md
```

如果是直接复制整个项目目录，则这些文件会一起带过去。

### 12.2 大概率需要改的路径

另一台电脑上最常变化的是：

```text
ESP-IDF 路径
Python 路径
IDF_TOOLS_PATH
Git 安装路径
```

推荐仍然使用类似目录：

```text
D:\esp-idf
C:\Users\<用户名>\AppData\Local\Programs\Python\Python311\python.exe
C:\Users\<用户名>\.espressif
```

如果 ESP-IDF 装在其他目录，例如：

```text
E:\tools\esp-idf
```

后续命令中的 `D:\esp-idf` 要替换为实际路径，或者启动脚本传入 `-IdfPath`。

### 12.3 新电脑准备步骤

安装并准备：

1. 安装 Python 3.11。
2. 安装或复制 ESP-IDF。
3. 安装 Git for Windows。
4. 使用 Chrome 或 Edge 浏览器。
5. 确认 USB 数据线和串口驱动可用。

先验证 Python：

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe" --version
```

正常应输出：

```text
Python 3.11.x
```

再验证 ESP-IDF：

```powershell
cd D:\esp-idf
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
$env:PATH="$env:LOCALAPPDATA\Programs\Python\Python311;$env:PATH"
.\export.ps1
python D:\esp-idf\tools\idf.py --version
```

正常应输出：

```text
ESP-IDF v...
```

### 12.4 补齐 ESP-IDF 子模块

如果新电脑的 ESP-IDF 是新 clone 或复制不完整，先执行：

```powershell
cd D:\esp-idf
git submodule update --init --recursive
```

如果网络不稳定，且构建只提示 `mbedtls` 缺失，可以先补最小必要子模块：

```powershell
cd D:\esp-idf
git submodule update --init --recursive components/mbedtls/mbedtls
```

如果 Git 报找不到 `basename`、`sed`、`git-sh-setup`，说明 Git for Windows 的 `usr\bin` 没在 PATH 中。按实际安装路径设置，例如：

```powershell
$env:PATH="C:\Program Files\Git\cmd;C:\Program Files\Git\usr\bin;$env:PATH"
```

如果 Git 装在 D 盘，则可能是：

```powershell
$env:PATH="D:\Program Files\Git\cmd;D:\Program Files\Git\usr\bin;$env:PATH"
```

### 12.5 使用启动脚本部署

进入项目目录：

```powershell
cd D:\esp-idf\examples\peripherals\lcd\st7789_simple
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

先检查环境：

```powershell
.\start_windows_server.ps1 -CheckOnly
```

通过时应看到类似：

```text
Project: D:\esp-idf\examples\peripherals\lcd\st7789_simple
ESP-IDF: D:\esp-idf
Python:  C:\Users\<用户名>\AppData\Local\Programs\Python\Python311\python.exe
Tools:   C:\Users\<用户名>\.espressif
IDF Python: C:\Users\<用户名>\.espressif\python_env\idf6.0_py3.11_env\Scripts\python.exe
ESP-IDF v...
Environment check passed.
```

检查通过后启动服务：

```powershell
.\start_windows_server.ps1
```

浏览器打开：

```text
http://127.0.0.1:8765
```

### 12.6 路径不同时的启动方式

如果 ESP-IDF 路径不同：

```powershell
.\start_windows_server.ps1 -IdfPath "E:\tools\esp-idf"
```

如果 Python 路径不同：

```powershell
.\start_windows_server.ps1 `
  -IdfPath "E:\tools\esp-idf" `
  -PythonExe "C:\Python311\python.exe"
```

如果 ESP-IDF tools 目录不同：

```powershell
.\start_windows_server.ps1 `
  -IdfPath "E:\tools\esp-idf" `
  -IdfToolsPath "D:\Espressif"
```

如果默认端口被占用：

```powershell
.\start_windows_server.ps1 -Port 8766
```

然后浏览器打开：

```text
http://127.0.0.1:8766
```

### 12.7 新电脑常见问题

如果 `-CheckOnly` 报：

```text
No module named 'click'
```

说明 ESP-IDF Python 虚拟环境没有正确安装或没有正确加载。先执行：

```powershell
cd D:\esp-idf
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
.\install.ps1
.\export.ps1
```

然后回到项目目录重新检查：

```powershell
cd D:\esp-idf\examples\peripherals\lcd\st7789_simple
.\start_windows_server.ps1 -CheckOnly
```

如果页面生成固件显示 500，先看服务端日志。常见处理：

```powershell
cd D:\esp-idf
git submodule update --init --recursive
```

如果烧录提示：

```text
Failed to initialize
```

通常不是部署问题，而是开发板没有进入下载模式。按住 `BOOT` 后点击页面 `INSTALL`，或用 `BOOT + RESET/EN` 手动进入下载模式。

### 12.8 最短部署流程

如果另一台电脑使用默认路径，最短流程如下：

```powershell
cd D:\esp-idf
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:IDF_TOOLS_PATH="$env:USERPROFILE\.espressif"
$env:PATH="$env:LOCALAPPDATA\Programs\Python\Python311;$env:PATH"
.\install.ps1
.\export.ps1
git submodule update --init --recursive

cd D:\esp-idf\examples\peripherals\lcd\st7789_simple
.\start_windows_server.ps1 -CheckOnly
.\start_windows_server.ps1
```

浏览器打开：

```text
http://127.0.0.1:8765
```
