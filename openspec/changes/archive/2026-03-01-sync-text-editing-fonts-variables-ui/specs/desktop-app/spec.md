# desktop-app Specification (delta)

## New Requirements

### Requirement: System font commands via font-kit
The Tauri backend SHALL expose two Rust commands using the font-kit crate: `list_system_fonts` (returns all system font families with style names, cached via OnceLock) and `load_system_font` (loads font data by family + style name, with weight matching and fallback to first font in family). The TS font shim SHALL detect Tauri runtime and use invoke() instead of queryLocalFonts.

#### Scenario: List system fonts
- **WHEN** the frontend calls list_system_fonts via Tauri invoke
- **THEN** a sorted list of font families with styles is returned

#### Scenario: Load specific font style
- **WHEN** the frontend requests "Inter" "Bold" via load_system_font
- **THEN** the font data (ArrayBuffer) is returned and registered with the font provider

#### Scenario: Font list caching
- **WHEN** list_system_fonts is called multiple times
- **THEN** the result is cached (OnceLock) and returned instantly after the first call

### Requirement: CSS font face registration
System font faces SHALL be registered with document.fonts for CSS preview in the font picker. Each system font creates a FontFace pointing to local() source.

#### Scenario: Font preview in picker
- **WHEN** system fonts are loaded in Tauri
- **THEN** font faces are registered so CSS can render preview text in each font

### Requirement: App identity
The Cargo crate SHALL be named `open_pencil` and the binary `OpenPencil`. The macOS Dock SHALL display "OpenPencil". The app icon SHALL use the pencil loader icon.

#### Scenario: macOS Dock name
- **WHEN** the app is running on macOS
- **THEN** the Dock displays "OpenPencil" (not "open-pencil-app")
