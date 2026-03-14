# Autoresearch Ideas

## High Priority
- **Badge proportional scaling (16 vectors + 3 badges + related)**: ~25 diffs. Badge instances have ~1.12x ratio mismatch. DSD provides size overrides for the Badge shell but they're not propagating to deeply nested children (vectors, avatars, close-icons, placeholders inside badges). Investigate DSD propagation depth.
- **Variable-bound fills (3 Indicators)**: Fill colors bound to design variables resolve differently in visible-page context. Need variable binding resolution during import.

## Medium Priority
- **datepicker width (7 nodes)**: `_datepicker-date-range-link` width 32 vs Figma's 131. Layout computation issue — needs proper text measurement context.
- **Self-referencing override for badge Placeholders (4 TEXT)**: Dark fills instead of white. The symbolOverride targets a CHILD cloned from the self-referencing component path. Current fix only handles exact `targetId === nodeId`.
- **chevron-down scaling (4 nodes)**: 16×16 vs 14.25×14.25. Similar to badge scaling issue.
- **Avatar distortion (3 nodes)**: 7.6×14 instead of 14.25×14.25. Constraint scaling applied wrong axis ratio.

## Low Priority  
- **Copy TEXT width (1 node)**: 36 vs 56 width. Text measurement/layout issue.
- **"12" TEXT width (5 nodes)**: 16.8 vs 19 width. Calendar date text measurement.
