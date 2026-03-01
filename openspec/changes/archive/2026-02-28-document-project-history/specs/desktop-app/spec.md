## ADDED Requirements

### Requirement: Tauri v2 desktop shell
The editor SHALL run as a native desktop app via Tauri v2 with the web frontend loaded in a webview.

#### Scenario: Desktop app launch
- **WHEN** user runs `bun run tauri dev`
- **THEN** a native desktop window opens with the editor UI and CanvasKit rendering

### Requirement: Native macOS menu bar
The desktop app SHALL display a native macOS menu bar with File, Edit, View, and Window menus.

#### Scenario: Menu bar presence
- **WHEN** the desktop app launches on macOS
- **THEN** a native menu bar with standard menus is visible

### Requirement: Menu events wired to frontend
Menu item clicks SHALL fire events that the Vue frontend handles (e.g., Undo, Redo, Zoom In/Out).

#### Scenario: Menu undo
- **WHEN** user clicks Edit → Undo in the menu bar
- **THEN** the frontend receives the undo event and performs undo

### Requirement: Developer tools menu item
The menu SHALL include a Developer Tools item (⌘⌥I) that opens the webview inspector.

#### Scenario: Open dev tools
- **WHEN** user selects View → Developer Tools or presses ⌘⌥I
- **THEN** the webview developer tools panel opens

### Requirement: Desktop directory structure
The Tauri configuration and Rust source SHALL live in `desktop/` (not `src-tauri/`). Tauri CLI SHALL find it by scanning.

#### Scenario: Build from desktop directory
- **WHEN** `bun run tauri build` is run
- **THEN** Tauri finds configuration in `desktop/` and produces a native binary
