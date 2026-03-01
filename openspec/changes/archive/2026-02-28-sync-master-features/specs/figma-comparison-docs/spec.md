## MODIFIED Requirements

### Requirement: Feature rows include notes
Each table row SHALL contain columns: Feature, Status, Notes. Statuses SHALL be updated when features are implemented. Specifically: Components (create/instance/detach) → 🟡 partial, Lock/unlock → ✅, Toggle visibility → ✅ (already was), Rename layers → 🟡, Z-order (bring to front/send to back) → ✅, Context menu → ✅ new row.

#### Scenario: Notes explain partial status
- **WHEN** a feature has 🟡 partial status
- **THEN** the Notes column explains what is supported and what is missing

#### Scenario: Component status updated
- **WHEN** user views the Components & Design Systems table
- **THEN** "Create components" shows 🟡 with note about what's implemented
