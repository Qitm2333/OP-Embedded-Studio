## ADDED Requirements

### Requirement: .fig file import
The editor SHALL import .fig files via the Kiwi codec pipeline: parse header (magic "fig-kiwi" + version), decompress Zstd, decode Kiwi schema, extract NodeChange[], and build the scene graph.

#### Scenario: Import a .fig file
- **WHEN** user opens a .fig file
- **THEN** all nodes from the file appear on the canvas with correct types, positions, sizes, and visual properties

### Requirement: File open via keyboard
⌘O SHALL open a file dialog for .fig import.

#### Scenario: Open file dialog
- **WHEN** user presses ⌘O
- **THEN** a file picker dialog appears filtered for .fig files

### Requirement: Blob reference resolution
The import pipeline SHALL resolve blob references (images, vector networks, font data) from the .fig file's blob section.

#### Scenario: Import with vector blobs
- **WHEN** a .fig file containing vector nodes with vectorNetworkBlob data is imported
- **THEN** the vector paths are correctly decoded and renderable
