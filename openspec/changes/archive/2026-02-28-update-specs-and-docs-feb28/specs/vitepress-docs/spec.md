## ADDED Requirements

### Requirement: Docs reflect sections feature
The features page SHALL document sections: SECTION node type, title pills, auto-adopt siblings, top-level-only constraint.

#### Scenario: Sections described in features
- **WHEN** user reads the features page
- **THEN** sections are documented with their behavior

### Requirement: Docs reflect multi-page support
The features page SHALL document multi-page documents: add/delete/rename pages, per-page viewport, pages panel.

#### Scenario: Pages described in features
- **WHEN** user reads the features page
- **THEN** multi-page support is documented

### Requirement: Docs reflect .fig export
The file-format page SHALL document .fig export: Save/Save As, Kiwi encoding, Zstd compression, thumbnail generation. The features page SHALL list .fig export as a capability.

#### Scenario: Export documented in file-format
- **WHEN** user reads the file-format reference
- **THEN** the export pipeline and supported formats table shows .fig export ✅

### Requirement: Docs reflect advanced rendering
The features page SHALL document tier 1 rendering: gradients, image fills, effects (shadows, blurs), stroke properties (cap, join, dash), arcs.

#### Scenario: Rendering features documented
- **WHEN** user reads the features page
- **THEN** gradient fills, image fills, effects, and stroke properties are described

### Requirement: Docs reflect updated keyboard shortcuts
The keyboard shortcuts page SHALL mark Section tool (S) as implemented (✅) and add Save (⌘S) and Save As (⇧⌘S) as implemented.

#### Scenario: New shortcuts marked
- **WHEN** user reads the keyboard shortcuts page
- **THEN** S (Section), ⌘S (Save), ⇧⌘S (Save As) show ✅ status

### Requirement: Docs reflect updated node types
The node-types reference SHALL list the current 17 types in the NodeType union used by the scene graph.

#### Scenario: Node types are current
- **WHEN** user reads the node types page
- **THEN** CANVAS, ROUNDED_RECTANGLE, COMPONENT, COMPONENT_SET, INSTANCE, CONNECTOR, SHAPE_WITH_TEXT are all listed

### Requirement: Roadmap reflects current progress
The roadmap page SHALL reflect that .fig export, sections, pages, hover highlight, and advanced rendering are now delivered.

#### Scenario: Roadmap is current
- **WHEN** user reads the roadmap page
- **THEN** Phase 3 lists .fig export and sections and pages as delivered
