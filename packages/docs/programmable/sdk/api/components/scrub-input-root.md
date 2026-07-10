---
title: ScrubInputRoot
description: Deprecated compatibility alias for NumberFieldRoot.
---

# ScrubInputRoot

::: warning Deprecated
Use [`NumberFieldRoot`](./number-field). `ScrubInputRoot` is a compatibility alias backed by the
same implementation and will be removed in a future cleanup release.
:::

Existing `modelValue`, `min`, `max`, `step`, `sensitivity`, `placeholder`, `update:modelValue`,
`commit`, and `editing-change` contracts remain available. The root slot now also exposes the
NumberField state, canonical `attrs` bag, expression input, keyboard stepping, and binding-aware
state.

## Migration

```diff
-import { ScrubInputRoot, ScrubInputField, ScrubInputDisplay } from '@open-pencil/vue'
+import { NumberFieldRoot, NumberFieldInput, NumberFieldValue } from '@open-pencil/vue'
```

See [NumberField](./number-field) for the complete anatomy and interaction contract.
