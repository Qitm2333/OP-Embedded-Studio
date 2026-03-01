## 1. Cross-platform menu compilation

- [x] 1.1 Wrap `app_menu` creation in `#[cfg(target_os = "macos")]` in `desktop/src/lib.rs`
- [x] 1.2 Use `let mut builder` pattern to conditionally include `app_menu` in `MenuBuilder`

## 2. README platform prerequisites

- [x] 2.1 Add macOS prerequisites subsection (Xcode Command Line Tools)
- [x] 2.2 Add Windows prerequisites subsection (Rust stable-msvc, Visual Studio Build Tools, WebView2)
- [x] 2.3 Add Linux prerequisites subsection (webkit2gtk and system libraries for Debian/Ubuntu, link to Tauri docs for other distros)
