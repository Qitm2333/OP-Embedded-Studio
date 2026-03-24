---
title: ColorPickerRoot
description: Headless popover-based color picker primitive.
---

# ColorPickerRoot

`ColorPickerRoot` is a headless popover-based color picker primitive.

It provides:

- a trigger slot with swatch background styling
- a default trigger fallback
- a content slot with `color` and `update()`

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Current color value.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Optional class for the popover content.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Optional class for the default trigger button.' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Emitted when the color changes.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: '{ style: Record<string, string> }', description: 'Custom trigger with swatch background style.' },
    { name: 'default', props: '{ color: Color, update: (color: Color) => void }', description: 'Main color editor content.' }
  ]"
/>

## Example

```vue
<ColorPickerRoot :color="color" @update="color = $event">
  <template #trigger="{ style }">
    <button class="size-6 rounded border" :style="style" />
  </template>

  <template #default="{ color, update }">
    <MyColorEditor :color="color" @change="update" />
  </template>
</ColorPickerRoot>
```

## Related APIs

- [ColorInputRoot](./color-input-root)
