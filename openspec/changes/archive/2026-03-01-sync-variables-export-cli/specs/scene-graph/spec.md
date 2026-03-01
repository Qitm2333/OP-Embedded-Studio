# scene-graph Specification (delta)

## New Requirements

### Requirement: Variable types
SceneGraph SHALL support Variable, VariableCollection, VariableCollectionMode types. VariableType is COLOR | FLOAT | STRING | BOOLEAN. VariableValue is Color | number | string | boolean | { aliasId: string }. Variables are stored in a Map keyed by ID. Collections group variables and define modes.

#### Scenario: Create color variable
- **WHEN** a COLOR variable is added with value { r: 1, g: 0, b: 0, a: 1 }
- **THEN** the variable is stored and resolvable by ID

### Requirement: Variable collections and modes
SceneGraph SHALL support variable collections with multiple modes (e.g., Light/Dark). Each collection has an activeMode. Mode switching changes which values are resolved for variables in that collection.

#### Scenario: Switch mode
- **WHEN** a collection has Light and Dark modes, and activeMode is switched to Dark
- **THEN** resolveVariable returns the Dark mode value for variables in that collection

### Requirement: Variable alias resolution
Variables SHALL support alias values ({ aliasId: string }) that reference other variables. Resolution follows the alias chain. Circular aliases SHALL be detected and return undefined (no infinite loop).

#### Scenario: Alias chain
- **WHEN** variable A aliases variable B which has value 42
- **THEN** resolving A returns 42

#### Scenario: Circular alias
- **WHEN** variable A aliases B and B aliases A
- **THEN** resolving A returns undefined

### Requirement: Variable binding to node properties
SceneGraph SHALL support binding variables to node properties via bindVariable(nodeId, field, variableId). Bound fields are stored in the node's variableBindings record. unbindVariable removes a binding.

#### Scenario: Bind color variable to fill
- **WHEN** a COLOR variable is bound to a node's fill
- **THEN** the node's variableBindings record contains the binding

### Requirement: Variable import from .fig files
The .fig import pipeline SHALL parse VARIABLE type NodeChanges and extract paint variable bindings, creating corresponding Variable and VariableCollection objects in the scene graph.

#### Scenario: Import .fig with variables
- **WHEN** a .fig file containing color variables and paint bindings is imported
- **THEN** the variables, collections, and bindings are restored in the scene graph

### Requirement: Remove variable cleans up bindings
Removing a variable SHALL clean up all bindings referencing it across all nodes.

#### Scenario: Remove variable with bindings
- **WHEN** a variable bound to three nodes is removed
- **THEN** all three nodes' variableBindings no longer reference that variable
