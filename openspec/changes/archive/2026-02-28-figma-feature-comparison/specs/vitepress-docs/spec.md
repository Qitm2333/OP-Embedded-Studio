## MODIFIED Requirements

### Requirement: Sidebar navigation
The VitePress config SHALL define a sidebar with logical grouping: Guide, Reference, Development. The Guide group SHALL include a "Figma Feature Matrix" entry after "Comparison" linking to `/guide/figma-comparison`.

#### Scenario: Sidebar groups
- **WHEN** user browses any documentation page
- **THEN** a sidebar shows three collapsible groups: Guide, Reference, Development

#### Scenario: Figma comparison in sidebar
- **WHEN** user views the Guide sidebar section
- **THEN** a "Figma Feature Matrix" entry appears after "Comparison" linking to `/guide/figma-comparison`
