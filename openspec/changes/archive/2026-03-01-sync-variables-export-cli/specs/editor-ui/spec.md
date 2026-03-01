# editor-ui Specification (delta)

## New Requirements

### Requirement: Variables panel
The editor SHALL include a VariablesPanel toggled from the bottom of the layers sidebar. The panel uses reka-ui Tabs for collections and Editable for variable names/values. Users can create, rename, and delete variables and collections, switch modes, and set variable values per mode.

#### Scenario: Toggle variables panel
- **WHEN** user clicks the variables toggle in the layers sidebar
- **THEN** the VariablesPanel appears showing collections as tabs

#### Scenario: Edit variable value
- **WHEN** user clicks a variable value in the panel
- **THEN** an editable input allows changing the value for the active mode

### Requirement: Fill section variable picker
The fill section SHALL include a variable picker (reka-ui Popover + Combobox) to bind a color variable to a fill. Bound fills display a purple variable name badge with a detach button.

#### Scenario: Bind variable to fill
- **WHEN** user selects a color variable from the fill variable picker
- **THEN** the fill shows a purple badge with the variable name

#### Scenario: Detach variable from fill
- **WHEN** user clicks the detach button on a bound fill
- **THEN** the variable binding is removed and the fill shows the resolved color

### Requirement: Export section in properties panel
The properties panel SHALL include an ExportSection when nodes are selected. The section provides: scale selector (0.5×, 0.75×, 1×, 1.5×, 2×, 3×, 4×), format picker (PNG, JPG, WEBP), multi-export support (add/remove export settings), live preview with checkerboard background, and an Export button. JPG uses white background, PNG/WEBP use transparency.

#### Scenario: Export as PNG
- **WHEN** user sets format to PNG, scale to 2×, and clicks Export
- **THEN** a 2× resolution PNG is saved via native dialog / FSAPI / download

#### Scenario: Export via context menu
- **WHEN** user right-clicks a node and selects "Export…"
- **THEN** the export flow starts for the selected node

#### Scenario: Export via keyboard shortcut
- **WHEN** user presses ⇧⌘E with a node selected
- **THEN** the export flow starts

### Requirement: Splash loader
The editor SHALL display a minimalist loading animation (centered logo + progress bar) during WASM (CanvasKit) initialization. The loader fades out when the canvas is ready.

#### Scenario: Initial load
- **WHEN** user opens the editor
- **THEN** a splash loader is shown until CanvasKit WASM is loaded, then fades out
