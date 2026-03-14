# Autoresearch Ideas

## High Priority (11 fill diffs)
- **Library variable alias resolution**: ALL remaining fill diffs are caused by `colorVar` on symbolOverride paints. The `paint.color` contains the fallback value but the `colorVar.value.alias.assetRef` references an EXTERNAL library variable. Local copy exists but with different GUID. Need to build mapping from `assetRef.key + version` → local variable ID using `variableConsumptionMap` entries on NodeChanges. This would fix all 11 fill diffs at once.

## Medium Priority (50 size diffs)
- **Badge area layout (~25 nodes)**: Badge INSTANCE width 96→85.32 is a Yoga layout issue. Auto-layout computes width from children sizes which depend on text measurement. Could improve by applying DSD size overrides to the Badge shell directly (if DSD entries exist but aren't resolving).
- **Datepicker width (7 nodes)**: `_datepicker-date-range-link` width 32→131. FIXED sizing but Figma shows wider — check if `layoutGrow` or parent `FILL` sizing should expand it.
- **Remaining Vector scaling (16 nodes)**: Inside Badge area. Would cascade-fix if Badge width is corrected.

## Investigated / Won't Fix In This Session
- Avatar distortion: Fixed by skipping auto-layout instances in constraint scaling
- 99 unmatched nodes: Fixed by name-based tree path matching
- cornerRadius 999 vs 890: Fixed by pill-shape tolerance
- Bold toolbar button fill: Fixed by self-referencing symbolOverride skip
- Icon cropping: Fixed by DSD single-child fallback + SCALE constraints
- Text measurement diffs (~10 nodes): Font-dependent, sub-2px differences
