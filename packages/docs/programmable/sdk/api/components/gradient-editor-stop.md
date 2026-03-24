---
title: GradientEditorStop
description: Headless slot primitive for a single gradient stop row.
---

# GradientEditorStop

`GradientEditorStop` is a headless primitive for rendering and editing a single gradient stop.

## Props

<SdkPropsTable
  :rows="[
    { name: 'stop', type: 'GradientStop', description: 'Current stop value.', required: true },
    { name: 'index', type: 'number', description: 'Current stop index.', required: true },
    { name: 'active', type: 'boolean', description: 'Whether this stop is active.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'select', payload: 'index: number', description: 'Emitted when the stop is selected.' },
    { name: 'updatePosition', payload: 'index: number, position: number', description: 'Emitted when the stop position changes.' },
    { name: 'updateColor', payload: 'index: number, hex: string', description: 'Emitted when the stop color changes.' },
    { name: 'updateOpacity', payload: 'index: number, opacity: number', description: 'Emitted when the stop opacity changes.' },
    { name: 'remove', payload: 'index: number', description: 'Emitted when the stop is removed.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: 'stop state + update handlers', description: 'Full gradient stop render contract.' }
  ]"
/>

### Default slot props

```ts
{
  stop: GradientStop
  index: number
  active: boolean
  positionPercent: number
  opacityPercent: number
  hex: string
  css: string
  select: () => void
  updatePosition: (position: number) => void
  updateColor: (hex: string) => void
  updateOpacity: (opacity: number) => void
  remove: () => void
}
```

## Example

```vue
<GradientEditorStop :stop="stop" :index="index" :active="active" v-slot="ctx">
  <MyGradientStopRow v-bind="ctx" />
</GradientEditorStop>
```

## Related APIs

- [GradientEditorRoot](./gradient-editor-root)
- [GradientEditorBar](./gradient-editor-bar)
