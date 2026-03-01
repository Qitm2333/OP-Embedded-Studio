# Proposal: Sync style runs, JSX renderer, CLI expansion, tests

## Why
22 commits merged from master (33d3def..6268d8b) introduce rich text formatting, a JSX renderer for programmatic design creation, expanded CLI analysis commands, .fig roundtrip tests, and major deduplication.

## What changed

### Rich text style runs (88bfacd)
- StyleRun model: `{start, length, style}` with CharacterStyleOverride (fontWeight, italic, textDecoration)
- Renderer: ParagraphBuilder.pushStyle/pop for mixed-style text within a single text node
- ⌘B/I/U apply to selection range (toggle per-selection) or whole-node style
- B/I/U/S toggle buttons in TypographySection
- .fig roundtrip: import characterStyleIDs + styleOverrideTable from TextData, export with deduped style table

### Text editing improvements (6268d8b)
- Double-click: select word at position, Triple-click: select all
- selectLine/selectLineAt added to TextEditor

### JSX renderer in @open-pencil/core (13f562a, a32d80f)
- TreeNode builder functions (Frame, Text, Rectangle, Ellipse, etc.)
- renderTreeNode(): tree → scene graph (browser)
- renderJsx(): JSX string → esbuild → tree → scene graph (CLI/headless)
- Tailwind-like shorthand props: w/h, bg, rounded, flex, gap, p/px/py, justify, items, shadow, blur
- 27 tests covering all node types, layout props, effects, nesting

### CLI expansion (36e3f14, 7dcc582)
- analyze colors: color palette usage with clustering
- analyze typography: font/size/weight distribution
- analyze spacing: gap/padding values with grid check
- analyze clusters: repeated patterns (potential components)
- node: detailed properties by ID
- pages: list pages with node counts
- variables: list design variables and collections

### Deduplication (f92a883, e3ae61e, 20827a2, 46bb923)
- kiwi-serialize.ts: shared sceneNodeToKiwi, buildFigKiwi, parseFigKiwiChunks
- Vendored kiwi-schema removed from src/kiwi/ (re-exports from core)
- jscpd added: 15.6% → 0.62% duplication
- Shared font weight mapping, layout merge, style-runs expandRuns helper

### .fig testing (f24f6e0, ca42214, f1806f6)
- Git LFS fixtures: material3.fig (87K nodes), nuxtui.fig (314K nodes)
- O(n²) getChildren() fix: 37s → 535ms on material3
- Roundtrip tests: property invariants, encode/decode cycle
- test:coverage script
- ByteBuffer optimization: inline readVarUint, TextDecoder for strings

### AI chat design (4fb9290, af6a98c, 017b0aa, cc5dda2)
- Planning documents only (PLAN.md), no implementation
- JSX-first rendering, OpenRouter from browser, Stronghold key storage
