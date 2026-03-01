## MODIFIED Requirements

### Requirement: Guide section
The docs site SHALL include a guide section with pages: Getting Started, Features, Architecture, Tech Stack. The Features page SHALL document components (create, instance, detach, component sets), context menu, z-order, visibility/lock toggle, move-to-page, and rendering optimizations (viewport culling, RAF coalescing).

#### Scenario: Getting started page
- **WHEN** user navigates to the Getting Started guide
- **THEN** installation instructions (`bun install`, `bun run dev`) and desktop app setup are displayed

#### Scenario: Architecture page
- **WHEN** user navigates to the Architecture guide
- **THEN** the system architecture diagram and component descriptions from PLAN.md are displayed

#### Scenario: Features page documents components
- **WHEN** user reads the features page
- **THEN** component creation, instances, detach, component sets, and context menu are described

### Requirement: Docs reflect updated keyboard shortcuts
The keyboard shortcuts page SHALL mark newly implemented shortcuts: ⌥⌘K (Create Component), ⌥⌘B (Detach Instance), ] (Bring Forward), [ (Send Backward), ⇧⌘H (Toggle Visibility), ⇧⌘L (Toggle Lock).

#### Scenario: Component shortcuts marked
- **WHEN** user reads the keyboard shortcuts page
- **THEN** ⌥⌘K, ⌥⌘B, ], [ show ✅ status

### Requirement: Roadmap reflects current progress
The roadmap page SHALL reflect that Phase 4 (Components + Variables) has partially started, with component creation, instances, component sets, and detach delivered.

#### Scenario: Phase 4 partial progress
- **WHEN** user reads the roadmap page
- **THEN** Phase 4 shows as 🟡 In Progress with components/instances listed as delivered
