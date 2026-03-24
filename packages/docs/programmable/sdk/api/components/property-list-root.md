---
title: PropertyListRoot
description: Headless structural primitive for fills, strokes, and effects list UIs.
---

# PropertyListRoot

`PropertyListRoot` is a headless structural primitive for array-based property editors.

It is intended for property UIs like:

- fills
- strokes
- effects

It provides slot props for:

- current items
- mixed-state detection
- add/remove/update/patch operations
- visibility toggling per item

## Usage

```vue
<PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
  <div v-for="(fill, index) in items" :key="index">
    <button @click="remove(index)">Remove</button>
  </div>
  <button @click="add(defaultFill)">Add fill</button>
</PropertyListRoot>
```

## Related APIs

- [SDK API Overview](../)
