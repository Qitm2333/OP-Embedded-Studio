## ADDED Requirements

### Requirement: Vue 3 + Reka UI component architecture
The editor UI SHALL be built with Vue 3, VueUse composables, and Reka UI headless components. The UI framework was migrated from React to Vue 3.

#### Scenario: Editor loads
- **WHEN** user opens the editor at localhost:1420
- **THEN** the Vue 3 application renders with canvas, toolbar, layers panel, and properties panel

### Requirement: Bottom toolbar
The toolbar SHALL be positioned at the bottom of the screen (Figma UI3 style) with tool selection: Select (V), Frame (F), Rectangle (R), Ellipse (O), Line (L), Text (T), Hand (H), Pen (P).

#### Scenario: Tool selection via keyboard
- **WHEN** user presses R
- **THEN** the rectangle tool is activated and the toolbar shows R as selected

### Requirement: Layers panel with tree view
The layers panel SHALL display a tree view of the document hierarchy using Reka UI Tree with expand/collapse and drag reordering.

#### Scenario: Expand/collapse frame children
- **WHEN** user clicks the chevron next to a frame in the layers panel
- **THEN** the frame's children are shown or hidden

#### Scenario: Drag reorder layers
- **WHEN** user drags a layer to a new position in the layers panel
- **THEN** the node's z-order in the scene graph changes accordingly

#### Scenario: Visibility toggle
- **WHEN** user clicks the visibility icon next to a layer
- **THEN** the node is hidden/shown on canvas

### Requirement: Properties panel with sections
The properties panel SHALL be split into sections: Appearance (size, position, rotation, opacity, corner radius, visibility), Fill, Stroke, Typography, Layout, Position.

#### Scenario: Properties panel shows fill section
- **WHEN** user selects a rectangle with a blue fill
- **THEN** the Fill section shows the hex color #3B82F6 with opacity and visibility controls

#### Scenario: Editable hex input
- **WHEN** user types a new hex value in the fill section
- **THEN** the node's fill updates to the entered color

### Requirement: Color picker
The color picker SHALL provide HSV color selection, hue slider, alpha slider, hex input, and opacity control.

#### Scenario: Change color via HSV
- **WHEN** user moves the color picker cursor in the HSV square
- **THEN** the selected node's fill updates in real time

### Requirement: Lucide icons via Iconify
UI icons SHALL use Lucide icons loaded via unplugin-icons with Iconify, replacing inline emoji/SVG.

#### Scenario: Icon rendering
- **WHEN** the toolbar renders tool icons
- **THEN** Lucide icons are displayed via the icon auto-import resolver

### Requirement: Tailwind CSS 4 styling
The editor SHALL use Tailwind CSS 4 for all styling.

#### Scenario: Dark theme
- **WHEN** the editor renders
- **THEN** the UI uses a dark theme styled with Tailwind CSS 4 utility classes
