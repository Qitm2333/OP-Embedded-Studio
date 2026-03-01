# scene-graph Specification (delta)

## New Requirements

### Requirement: Scene node to JSX export
@open-pencil/core SHALL export a sceneNodeToJsx() function that converts a SceneNode subtree into JSX string using builder function syntax (Frame, Text, Rectangle, etc.) with Tailwind-like shorthand props. The output is valid JSX that can be consumed by renderJsx().

#### Scenario: Export frame with children
- **WHEN** sceneNodeToJsx is called on a frame with a rectangle and text child
- **THEN** a JSX string with Frame wrapping Rectangle and Text is returned

#### Scenario: Export with effects
- **WHEN** sceneNodeToJsx is called on a node with drop shadow
- **THEN** the JSX includes shadow props in the output
