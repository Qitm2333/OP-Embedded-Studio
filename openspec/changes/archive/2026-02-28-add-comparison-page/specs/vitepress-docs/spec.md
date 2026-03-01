## ADDED Requirements

### Requirement: Comparison page
The docs site SHALL include a comparison page at `/guide/comparison` documenting architecture, rendering, data model, layout, file format, state management, developer experience, and performance differences between OpenPencil and Penpot.

#### Scenario: Comparison page renders
- **WHEN** user navigates to /guide/comparison
- **THEN** a page with all 10 comparison sections and the summary table is displayed

### Requirement: Comparison in sidebar navigation
The VitePress sidebar SHALL include a "Comparison" link in the Guide section after Tech Stack.

#### Scenario: Sidebar shows comparison
- **WHEN** user views the Guide sidebar
- **THEN** a "Comparison" entry appears after "Tech Stack" linking to /guide/comparison
