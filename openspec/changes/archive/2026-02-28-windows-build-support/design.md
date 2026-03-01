## Context

The Tauri v2 desktop app's menu setup in `desktop/src/lib.rs` uses macOS-specific `PredefinedMenuItem` variants (About, Services, Hide, Hide Others, Show All) that are unavailable on Windows and Linux. The app_menu submenu containing these items is a macOS convention (the "application name" menu left of File). Windows and Linux apps don't have this submenu.

README only documents `bun install` + `bun run dev` for the web mode. Desktop build prerequisites vary by platform and are not documented.

## Goals / Non-Goals

**Goals:**
- Desktop app compiles and runs on Windows and Linux (in addition to macOS)
- README documents platform-specific prerequisites for all three platforms

**Non-Goals:**
- Platform-specific UI adaptations beyond the menu bar
- CI/CD pipeline for cross-platform builds
- Automated testing on Windows/Linux

## Decisions

### 1. `#[cfg(target_os = "macos")]` for app_menu

Wrap the entire app_menu (OpenPencil submenu) in a compile-time conditional. On non-macOS platforms, the menu starts directly with File.

**Alternative considered:** Runtime detection via `std::env::consts::OS` — rejected because menu construction happens at build time with Tauri's type system, and conditional compilation is the idiomatic Rust/Tauri pattern used by other projects (museeks, gitbutler).

### 2. `mut builder` pattern for conditional menu assembly

Use `let mut builder = MenuBuilder::new(app)` then conditionally `builder = builder.item(&app_menu)` inside a `#[cfg]` block, followed by `.items(&[...])` for the shared menus.

**Alternative considered:** Two separate `MenuBuilder` chains (one for macOS, one for others) — rejected to avoid duplicating the shared menu list.

## Risks / Trade-offs

- **[PredefinedMenuItem::fullscreen on Windows]** The `fullscreen` item in view_menu uses a macOS predefined — may be a no-op on Windows. Low risk, Tauri handles this gracefully. → Monitor and wrap in `#[cfg]` if needed later.
- **[README link rot]** Microsoft URLs for Visual Studio Build Tools may change. → Added descriptive text as fallback.
