## ADDED Requirements

### Requirement: Pages panel
The editor SHALL display a PagesPanel component showing all pages in the document. Users can switch pages, add pages, delete pages, and rename pages inline (blur commits, Enter/Escape just blur).

#### Scenario: Switch page
- **WHEN** user clicks a page tab in the pages panel
- **THEN** the canvas switches to that page and viewport state is restored

#### Scenario: Add page
- **WHEN** user clicks the add page button
- **THEN** a new page is created and becomes active

#### Scenario: Inline page rename
- **WHEN** user double-clicks a page name
- **THEN** an inline text input appears, blur commits the rename

### Requirement: Section tool
The toolbar SHALL include a Section tool (shortcut <kbd>S</kbd>) in the Frame flyout. Drawing on canvas creates a SECTION node.

#### Scenario: Section tool activation
- **WHEN** user presses S
- **THEN** the section tool activates and the toolbar shows Section as selected

### Requirement: Fill type picker with gradient and image support
The fill section in the properties panel SHALL provide a type picker with tabs: Solid, Gradient (Linear, Radial, Angular, Diamond), and Image. Gradient fills show editable gradient stops. Image fills show image selection.

#### Scenario: Switch fill to linear gradient
- **WHEN** user selects "Linear Gradient" from the fill type picker
- **THEN** the selected node's fill changes to GRADIENT_LINEAR with default stops and the gradient stop editor appears

#### Scenario: Edit gradient stop
- **WHEN** user drags a gradient stop to position 50%
- **THEN** the stop position updates and the node re-renders with the adjusted gradient

### Requirement: Page background color
The properties panel SHALL show a page section with canvas background color picker when no nodes are selected.

#### Scenario: Change canvas background
- **WHEN** user selects no nodes and changes the page color
- **THEN** the canvas background updates to the chosen color

### Requirement: Hover highlight in canvas
The editor SHALL highlight nodes on hover with a shape-aware outline (follows actual geometry, not just bounding box).

#### Scenario: Hover feedback
- **WHEN** user moves cursor over a node without clicking
- **THEN** a highlight outline appears around the node shape

## MODIFIED Requirements

### Requirement: Bottom toolbar
The toolbar SHALL be positioned at the bottom of the screen (Figma UI3 style) with tool selection: Select (V), Frame (F), Section (S, in Frame flyout), Rectangle (R), Ellipse (O), Line (L), Text (T), Hand (H), Pen (P).

#### Scenario: Tool selection via keyboard
- **WHEN** user presses R
- **THEN** the rectangle tool is activated and the toolbar shows R as selected

#### Scenario: Frame flyout includes Section
- **WHEN** user opens the Frame tool flyout
- **THEN** both Frame and Section tools are available
