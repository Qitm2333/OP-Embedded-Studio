## ADDED Requirements

### Requirement: Paste from Figma
The editor SHALL accept paste events containing fig-kiwi binary data from Figma's clipboard. Pasted nodes SHALL be decoded and added to the scene graph.

#### Scenario: Paste Figma nodes
- **WHEN** user copies a frame in Figma and pastes in OpenPencil
- **THEN** the frame and its children appear on the canvas with preserved properties

### Requirement: Copy for Figma compatibility
The editor SHALL encode selected nodes as fig-kiwi binary on copy, allowing paste into Figma or other OpenPencil instances.

#### Scenario: Copy to Figma
- **WHEN** user copies a rectangle in OpenPencil and pastes in Figma
- **THEN** the rectangle appears in Figma with preserved fill, stroke, and dimensions

### Requirement: Native copy/paste events
Clipboard operations SHALL use native copy/paste browser events (not async Clipboard API) and build the fig-kiwi binary synchronously in the event handler.

#### Scenario: Synchronous clipboard encoding
- **WHEN** user presses ⌘C with a node selected
- **THEN** the fig-kiwi binary is built synchronously within the copy event handler

### Requirement: Cut operation
Cut SHALL copy nodes to clipboard and delete them from the scene graph.

#### Scenario: Cut and paste
- **WHEN** user cuts a node and pastes
- **THEN** the original is removed and a copy appears at the paste position

### Requirement: Copy between instances
Copy/paste SHALL work between multiple OpenPencil browser tabs/windows.

#### Scenario: Cross-instance paste
- **WHEN** user copies a node in one OpenPencil tab and pastes in another
- **THEN** the node appears in the second tab with all properties preserved
