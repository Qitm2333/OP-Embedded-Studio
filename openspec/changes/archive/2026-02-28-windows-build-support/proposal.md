## Why

The desktop app menu code uses macOS-specific items (Services, Hide, Hide Others, Show All) that don't exist on Windows/Linux, and the README lacks platform setup instructions. This blocks Windows contributors from building and running the app.

## What Changes

- Conditional compilation of the macOS app menu (`#[cfg(target_os = "macos")]`) so the desktop app compiles and runs on Windows and Linux
- Platform-specific setup instructions in README (Windows, macOS, Linux prerequisites)

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `desktop-app`: Menu bar requirements change from macOS-only to cross-platform. App menu (About, Services, Hide, etc.) is macOS-only; other menus (File, Edit, View, Object, Window, Help) work on all platforms.

## Impact

- `desktop/src/lib.rs` — conditional compilation of app_menu submenu
- `README.md` — new Platform Prerequisites section with Windows, macOS, Linux instructions
