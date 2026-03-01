## MODIFIED Requirements

### Requirement: Sidebar navigation
The VitePress config SHALL define a sidebar with logical grouping: User Guide, Guide, Reference, Development. The User Guide group SHALL appear first and include entries for all user guide articles. The Guide group SHALL include a "Figma Feature Matrix" entry after "Comparison" linking to `/guide/figma-comparison`.

#### Scenario: Sidebar groups
- **WHEN** user browses any documentation page
- **THEN** a sidebar shows four collapsible groups: User Guide, Guide, Reference, Development

#### Scenario: User Guide sidebar entries
- **WHEN** user views the User Guide sidebar section
- **THEN** entries for all 12 user guide articles are listed in logical order

#### Scenario: Figma comparison in sidebar
- **WHEN** user views the Guide sidebar section
- **THEN** a "Figma Feature Matrix" entry appears after "Comparison" linking to `/guide/figma-comparison`
