## MODIFIED Requirements

### Requirement: Native macOS menu bar
The desktop app SHALL display a native menu bar. On macOS, an app-level submenu (OpenPencil) with About, Services, Hide, Hide Others, Show All, and Quit items SHALL be shown. On Windows and Linux, this submenu SHALL be omitted. File, Edit, View, Object, Window, and Help menus SHALL be present on all platforms.

#### Scenario: Menu bar on macOS
- **WHEN** the desktop app launches on macOS
- **THEN** a native menu bar with the OpenPencil app submenu and all standard menus is visible

#### Scenario: Menu bar on Windows
- **WHEN** the desktop app launches on Windows
- **THEN** a native menu bar with File, Edit, View, Object, Window, and Help menus is visible and no macOS-specific app submenu is present

#### Scenario: Menu bar on Linux
- **WHEN** the desktop app launches on Linux
- **THEN** a native menu bar with File, Edit, View, Object, Window, and Help menus is visible and no macOS-specific app submenu is present

## ADDED Requirements

### Requirement: Cross-platform build
The desktop app SHALL compile and build on macOS, Windows, and Linux without platform-specific errors.

#### Scenario: Windows build
- **WHEN** `bun run tauri build` is run on Windows with MSVC toolchain installed
- **THEN** the build completes successfully and produces a Windows executable

#### Scenario: Linux build
- **WHEN** `bun run tauri build` is run on Linux with required system libraries installed
- **THEN** the build completes successfully and produces a Linux binary

### Requirement: Platform prerequisites documentation
The README SHALL document platform-specific prerequisites for building the desktop app on macOS, Windows, and Linux.

#### Scenario: Windows prerequisites documented
- **WHEN** a developer reads the README on Windows
- **THEN** they find instructions for installing Rust (stable-msvc), Visual Studio Build Tools, and WebView2

#### Scenario: macOS prerequisites documented
- **WHEN** a developer reads the README on macOS
- **THEN** they find instructions for installing Xcode Command Line Tools

#### Scenario: Linux prerequisites documented
- **WHEN** a developer reads the README on Linux
- **THEN** they find instructions for installing required system libraries (webkit2gtk, etc.)
