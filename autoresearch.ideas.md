# Autoresearch Ideas

## High Priority
- **Vector constraint resizing**: 38 vectors have wrong sizes because instances smaller than their component don't resize children via constraints. Figma uses horizontal/vertical constraints to scale children when instance size ≠ component size. Need to implement constraint-based resizing after population.
- **Variable-bound fills**: 3 Indicator nodes have wrong fill colors because their fills are bound to design variables that resolve differently in the visible-page context. Need to resolve variable bindings during import.
- **Self-referencing symbolOverride pattern**: 4 Placeholder TEXT nodes have dark fills instead of white. Same pattern as bold toolbar button — the instance's own kiwi NC has correct fills but a symbolOverride targeting the component shell overwrites them. The current fix only handles exact self-reference (targetId === nodeId). Need to also handle cases where the override targets a CHILD that was cloned from the self-referencing path.

## Medium Priority  
- **datepicker width**: 6 `_datepicker-date-range-link` instances have width 32 vs Figma's 131. Likely DSD size override or layout recomputation issue.
- **Badge scaling**: Badge/Avatar/Placeholder/Close-Icon ~1.12x ratio diffs — proportional scaling issue from DSD not fully applied.

## Low Priority
- **99 unmatched nodes**: Figma has 99 nodes that don't match by tree path. Likely node ordering or naming differences in deep clone chains.
