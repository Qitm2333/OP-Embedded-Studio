# kiwi-codec Specification

## Purpose
Vendored Kiwi binary codec for Figma's 194-definition schema. Encodes/decodes NodeChange messages, handles sparse field IDs, and integrates Zstd compression for .fig file compatibility.
## Requirements
### Requirement: Vendored kiwi-schema
The project SHALL vendor kiwi-schema (from evanw/kiwi) with patches for ESM module format and sparse field ID handling.

#### Scenario: ESM import
- **WHEN** kiwi-schema is imported as an ES module
- **THEN** all encoder/decoder functions are available without CommonJS compatibility issues

### Requirement: Kiwi binary codec
The codec SHALL encode and decode Figma's 194-definition Kiwi schema including the NodeChange message type with ~390 fields.

#### Scenario: Decode a Kiwi message
- **WHEN** a compressed Kiwi binary is provided
- **THEN** the codec decodes it into a structured NodeChange[] array

#### Scenario: Encode a Kiwi message
- **WHEN** a NodeChange[] array is provided
- **THEN** the codec encodes it into Kiwi binary format

### Requirement: Sparse field ID support
The kiwi-schema parser SHALL handle sparse field IDs (non-contiguous field numbering) used by Figma's schema.

#### Scenario: Parse schema with sparse IDs
- **WHEN** a Kiwi schema definition has field IDs like 1, 2, 5, 10 (with gaps)
- **THEN** the parser correctly handles all fields without errors

### Requirement: Zstd compression
The codec layer SHALL support Zstd decompression for .fig file payloads and compression for clipboard/export.

#### Scenario: Decompress .fig payload
- **WHEN** a Zstd-compressed Kiwi payload is encountered in a .fig file
- **THEN** it is decompressed before Kiwi decoding

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

