---
title: ScrubInputRoot
description: Headless root primitive for drag-to-scrub numeric input.
---

# ScrubInputRoot

`ScrubInputRoot` is the headless root primitive for drag-to-scrub numeric input.

It manages:

- mixed-value display
- editing vs scrubbing state
- pointer-driven numeric scrubbing
- commit semantics for finished edits

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Current numeric value or mixed sentinel.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Minimum allowed value.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Maximum allowed value.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Scrub step multiplier.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Pointer sensitivity multiplier.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Placeholder for mixed values.', default: 'Mixed' }
  ]"
/>

## Model

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Writable numeric model.', required: true }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Emitted while scrubbing or editing.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Emitted when an edit interaction is committed.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Full scrub-input render contract.' }
  ]"
/>

## Example

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## Related APIs

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
