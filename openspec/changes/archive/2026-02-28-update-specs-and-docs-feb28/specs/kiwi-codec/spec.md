## ADDED Requirements

### Requirement: Kiwi encoding for .fig export
The Kiwi codec SHALL support encoding NodeChange[] back to Kiwi binary format for .fig export. The encoding path mirrors the decoding path: scene graph → NodeChange[] → Kiwi encode → compress → ZIP with header.

#### Scenario: Encode scene graph to Kiwi binary
- **WHEN** the editor exports a document
- **THEN** all nodes are encoded as NodeChange messages using the Kiwi schema and the binary output is a valid fig-kiwi payload

### Requirement: .fig ZIP built in Rust
On the desktop app, the .fig ZIP archive SHALL be assembled in Rust instead of JavaScript (fflate) for better performance and correct Zstd framing (content size in header).

#### Scenario: Rust ZIP assembly
- **WHEN** a .fig file is exported on the desktop app
- **THEN** the ZIP is assembled by the Rust backend with correct Zstd frame headers
