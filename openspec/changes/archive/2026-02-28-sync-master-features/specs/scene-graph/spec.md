## MODIFIED Requirements

### Requirement: Scene node data model
The scene graph SHALL store nodes in a flat `Map<string, SceneNode>` with parent-child tree via parentIndex. Each SceneNode SHALL include `componentId` (nullable reference to main component for instances) and `overrides` (record of instance-level property overrides).

#### Scenario: Node has component fields
- **WHEN** a SceneNode is created
- **THEN** it has `componentId: null` and `overrides: {}` by default

## ADDED Requirements

### Requirement: Clone tree
The scene graph SHALL support deep-cloning a node subtree to a new parent via `cloneTree(sourceId, parentId)`, copying all properties and recursively cloning children.

#### Scenario: Clone subtree
- **WHEN** `cloneTree` is called on a frame with two children
- **THEN** a new frame with two new children is created under the target parent

### Requirement: Create instance from component
The scene graph SHALL support creating an INSTANCE node from a COMPONENT via `createInstance(componentId, parentId)`, copying visual properties and deep-cloning children.

#### Scenario: Instance copies component children
- **WHEN** `createInstance` is called for a component with three children
- **THEN** the instance has three cloned children matching the component's

### Requirement: Detach instance
The scene graph SHALL support converting an INSTANCE to FRAME via `detachInstance(instanceId)`, clearing `componentId` and `overrides`.

#### Scenario: Detach changes type
- **WHEN** `detachInstance` is called on an instance
- **THEN** its type becomes FRAME and componentId becomes null

### Requirement: Get main component
The scene graph SHALL support `getMainComponent(instanceId)` returning the source COMPONENT for an instance.

#### Scenario: Retrieve main component
- **WHEN** `getMainComponent` is called on an instance
- **THEN** the linked COMPONENT node is returned

### Requirement: Deep hit testing
The scene graph SHALL support `hitTestDeep(px, py)` that traverses into COMPONENT and INSTANCE containers, unlike standard `hitTest` which treats them as opaque.

#### Scenario: Deep hit test enters component
- **WHEN** `hitTestDeep` is called at a position inside a component's child
- **THEN** the child is returned, not the component
