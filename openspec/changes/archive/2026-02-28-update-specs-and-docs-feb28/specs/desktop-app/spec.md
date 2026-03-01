## ADDED Requirements

### Requirement: Tauri native Save/Open dialogs
The desktop app SHALL use Tauri plugin-dialog and plugin-fs for native file dialogs and filesystem access. Open dialog filters for .fig files. Save dialog defaults to "Untitled.fig".

#### Scenario: Open file via native dialog
- **WHEN** user presses ⌘O in the desktop app
- **THEN** the native OS file picker opens and the selected .fig file is imported

#### Scenario: Save As via native dialog
- **WHEN** user selects File → Save As
- **THEN** a native OS save dialog opens and the file is written to the chosen path

### Requirement: Zstd compression via Rust command
The Tauri backend SHALL expose a Rust command for Zstd compression/decompression, used by .fig export for better performance than JavaScript alternatives.

#### Scenario: Zstd compress via IPC
- **WHEN** the frontend requests Zstd compression of a buffer
- **THEN** the Rust backend compresses it and returns the result via Tauri IPC
