## ADDED Requirements

### Requirement: .fig file export
The editor SHALL export documents as .fig files. The pipeline: scene graph → Kiwi encode NodeChange[] → compress → write ZIP with fig-kiwi header, schema, message, and thumbnail.

#### Scenario: Save As .fig
- **WHEN** user selects File → Save As
- **THEN** a save dialog appears and the document is written as a valid .fig file

#### Scenario: Save existing file
- **WHEN** user selects File → Save (⌘S) with a previously opened file
- **THEN** the file is overwritten in place without a dialog

### Requirement: Thumbnail generation for .fig export
Exported .fig files SHALL include a thumbnail.png in the ZIP archive, as required by Figma for file preview.

#### Scenario: Thumbnail in exported file
- **WHEN** a .fig file is exported
- **THEN** the ZIP archive contains a thumbnail.png

### Requirement: Zstd compression via Tauri Rust
On the desktop app, .fig export SHALL use Zstd compression via a Tauri Rust command for performance. In the browser, deflate fallback via fflate SHALL be used.

#### Scenario: Desktop export uses Zstd
- **WHEN** a .fig file is exported in the Tauri desktop app
- **THEN** the payload is compressed with Zstd via the Rust backend

#### Scenario: Browser export uses deflate
- **WHEN** a .fig file is exported in the browser
- **THEN** the payload is compressed with deflate as a fallback

### Requirement: Tauri native file dialogs
File Open and Save dialogs SHALL use Tauri's plugin-dialog for native OS dialogs on the desktop app. Save filters for .fig files.

#### Scenario: Native open dialog
- **WHEN** user presses ⌘O in the desktop app
- **THEN** the native OS file picker opens filtered for .fig files

#### Scenario: Native save dialog
- **WHEN** user selects Save As in the desktop app
- **THEN** the native OS save dialog opens with default filename "Untitled.fig"

### Requirement: Tier 1 rendering parity for import
The .fig import pipeline SHALL correctly import and render gradient fills, image fills, effects (shadows, blurs), stroke properties (cap, join, dash), and arc data.

#### Scenario: Import file with gradients
- **WHEN** a .fig file containing nodes with gradient fills is imported
- **THEN** all gradient types (linear, radial, angular, diamond) render correctly with their stops and transforms

### Requirement: .fig import/export round-trip
A .fig file imported and then exported SHALL produce a file that Figma can open with the same visual result.

#### Scenario: Round-trip fidelity
- **WHEN** a .fig file is imported into OpenPencil and re-exported
- **THEN** the exported file opens in Figma with matching visual output
