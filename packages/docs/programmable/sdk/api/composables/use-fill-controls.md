---
title: useFillControls
description: Fill-panel composable with default fill behavior and variable binding support.
---

# useFillControls

`useFillControls()` is the fill-property composable used by fill editing UIs.

It builds on variable-binding support and adds a reusable default fill value.

## Usage

```ts
import { useFillControls } from '@open-pencil/vue'

const fills = useFillControls()
```

## What it gives you

Along with fill binding behavior, it exposes:

- `defaultFill`
- fill variable-binding helpers
- selection-aware fill editing state

## Practical examples

### Add a new fill row

```ts
propertyList.add(fills.defaultFill)
```

## Related APIs

- [PropertyListRoot](../components/property-list-root)
