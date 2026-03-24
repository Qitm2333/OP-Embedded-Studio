---
title: FillPickerRoot
description: Headless popover-based fill picker primitive.
---

# FillPickerRoot

`FillPickerRoot` is a headless popover-based fill picker for solid, gradient, and image fills.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Current fill value.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Optional class for the popover content.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Optional class for the default trigger button.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Emitted when the fill changes.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'swatch style', description: 'Custom trigger with swatch background style.' },
    { name: 'default', props: 'fill state + conversion helpers', description: 'Main fill editor content.' }
  ]"
/>

### Trigger slot props

```ts
{
  style: Record<string, string>
}
```

### Default slot props

```ts
{
  fill: Fill
  category: 'SOLID' | 'GRADIENT' | 'IMAGE'
  toSolid: () => void
  toGradient: () => void
  toImage: () => void
  update: (fill: Fill) => void
}
```

## Example

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Solid</button>
    <button @click="toGradient">Gradient</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## Related APIs

- [GradientEditorRoot](./gradient-editor-root)
