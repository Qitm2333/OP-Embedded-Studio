# scene-graph Specification (delta)

## New Requirements

### Requirement: StyleRun model
SceneNode SHALL support a `styleRuns` array of `{start, length, style}` where style is CharacterStyleOverride (fontWeight, italic, textDecoration). The scene graph SHALL provide helpers to apply/toggle styles on ranges and adjust runs on insert/delete.

#### Scenario: Apply bold to range
- **WHEN** applyStyleToRange is called with fontWeight 700 on characters 6–11
- **THEN** the styleRuns array contains a run for that range with fontWeight 700

### Requirement: JSX renderer
@open-pencil/core SHALL export TreeNode builder functions (Frame, Text, Rectangle, Ellipse, etc.) and two rendering paths: renderTreeNode() (tree → scene graph, no deps) and renderJsx() (JSX string → esbuild → tree → scene graph, for CLI/headless). Builder functions SHALL accept Tailwind-like shorthand props: w, h, bg, rounded, flex, gap, p/px/py, justify, items, shadow, blur.

#### Scenario: Build tree from functions
- **WHEN** Frame({w: 200, h: 100, bg: '#f00'}, [Text({children: 'Hello'})]) is called
- **THEN** a TreeNode with type FRAME, width 200, height 100, and red fill is created with a TEXT child

#### Scenario: Render JSX string
- **WHEN** renderJsx('<Frame w={100}><Text>Hi</Text></Frame>') is called
- **THEN** a scene graph with a FRAME parent and TEXT child is produced
