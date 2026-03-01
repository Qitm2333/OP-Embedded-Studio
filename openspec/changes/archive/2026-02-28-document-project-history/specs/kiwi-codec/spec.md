## ADDED Requirements

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
