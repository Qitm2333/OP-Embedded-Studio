# editor-ui Specification (delta)

## Modified Requirements

### Requirement: Variables panel (MODIFIED → Variables dialog)
The editor SHALL display a VariablesSection in the page-level properties panel showing variable/collection counts and a settings icon. Clicking the icon opens a VariablesDialog (reka-ui Dialog) with: collection tabs (reka-ui Tabs, double-click to rename), a TanStack Table (@tanstack/vue-table) with resizable columns (Name | Mode 1 | Mode 2 | ...), search bar, and a "+ Create variable" button. Color variables display inline ColorInput with picker. Variable names and values are editable inline (reka-ui Editable).

#### Scenario: Open variables dialog
- **WHEN** user clicks the settings icon in the Variables section of page properties
- **THEN** a dialog opens showing collection tabs and a variables table

#### Scenario: Rename collection
- **WHEN** user double-clicks a collection tab name
- **THEN** the tab becomes editable for renaming

#### Scenario: Resize table columns
- **WHEN** user drags a column border in the variables table header
- **THEN** the column width adjusts

#### Scenario: Search variables
- **WHEN** user types in the search bar in the variables dialog
- **THEN** only variables matching the search term are shown

## New Requirements

### Requirement: ColorInput component
A reusable ColorInput component SHALL display a color swatch with ColorPicker and an optional hex input. It SHALL replace duplicated color picker + hex input patterns in PageSection, StrokeSection, EffectsSection, and VariablesDialog.

#### Scenario: Color input with editing
- **WHEN** ColorInput is rendered with editable=true
- **THEN** a swatch with picker and an editable hex input are shown

#### Scenario: Color input read-only
- **WHEN** ColorInput is rendered with editable=false (default)
- **THEN** a swatch with picker and a read-only hex label are shown

### Requirement: ColorPicker alpha slider checkerboard
The ColorPicker alpha slider SHALL display a checkerboard background behind the transparent-to-color gradient, matching FillPicker's implementation.

#### Scenario: Alpha slider visual
- **WHEN** user opens a ColorPicker
- **THEN** the alpha slider shows a checkerboard pattern indicating transparency

### Requirement: Demo variable collections
The demo document SHALL include three variable collections demonstrating multi-mode and alias features: Primitives (Light/Dark modes, 9 color variables), Semantic (aliases to Primitives), and Spacing (Default/Compact modes, 8 number variables). Variables SHALL be bound to demo nodes.

#### Scenario: Demo loads with variables
- **WHEN** the demo document is created
- **THEN** three collections with variables and bindings are present in the scene graph
