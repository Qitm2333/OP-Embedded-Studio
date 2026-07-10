---
title: NumberField
description: Headless numeric field primitives with scrubbing, expressions, and keyboard stepping.
---

# NumberField

The NumberField family provides a headless numeric control with pointer scrubbing, mixed values,
keyboard stepping, safe arithmetic expressions, units, trailing actions, and binding-aware state.

## Anatomy

- `NumberFieldRoot` — renderless state and interaction owner
- `NumberFieldLeading` — leading label or icon
- `NumberFieldValue` — non-editing value
- `NumberFieldInput` — editing input with spinbutton semantics
- `NumberFieldUnit` — unit text
- `NumberFieldTrailing` — trailing action area
- `NumberFieldMenu` — field menu area

## Root props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Current value or mixed sentinel.', required: true },
    { name: 'min', type: 'number', description: 'Minimum value.', default: '-Infinity' },
    { name: 'max', type: 'number', description: 'Maximum value and percentage basis.', default: 'Infinity' },
    { name: 'step', type: 'number', description: 'Scrub and Arrow-key step.', default: '1' },
    { name: 'sensitivity', type: 'number', description: 'Pointer scrub sensitivity.', default: '1' },
    { name: 'placeholder', type: 'string', description: 'Mixed-value placeholder.', default: 'Mixed' },
    { name: 'ariaLabel', type: 'string', description: 'Accessible name propagated to the root attrs and editing input.' },
    { name: 'disabled', type: 'boolean', description: 'Disables all interactions.', default: 'false' },
    { name: 'bound', type: 'boolean', description: 'Exposes bound state to slots and data attributes.', default: 'false' },
    { name: 'editPolicy', type: `'editable' | 'readonly' | 'detach-on-edit'`, description: 'Interaction policy for a bound value.', default: 'editable' }
  ]"
/>

## Events

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Emitted for live numeric updates and expression results.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Emitted once for a changed committed interaction.' },
    { name: 'editing-change', payload: 'editing: boolean', description: 'Editing state changed.' },
    { name: 'invalid', payload: 'expression: string, reason: NumberExpressionError', description: 'An invalid expression was reverted.' },
    { name: 'detach-request', payload: `source: 'edit' | 'scrub' | 'step'`, description: 'A bound detach-on-edit interaction is about to mutate.' }
  ]"
/>

## Root slot

The default slot receives `modelValue`, `displayValue`, `draftValue`, `placeholder`, all state
booleans, `state`, `actions`, and `attrs`. Bind `attrs` to the focusable outer element. It contains
the canonical spinbutton ARIA contract, keyboard/focus handlers, and `data-editing`,
`data-scrubbing`, `data-mixed`, `data-disabled`, and `data-bound` attributes.

## Expressions and keyboard

Committed input accepts absolute arithmetic such as `12*8+4`, relative operations such as
`+10`, `-4`, `*2`, and `/3`, and percentages such as `50%` when `max` is finite. The parser only
accepts numbers, parentheses, and `+ - * /`; it never evaluates JavaScript.

Arrow keys step by `step`. Shift multiplies the step by 10 and Alt multiplies it by 0.1. Enter
commits and Escape restores the interaction-start value.

## Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import {
  NumberFieldInput,
  NumberFieldLeading,
  NumberFieldRoot,
  NumberFieldUnit,
  NumberFieldValue
} from '@open-pencil/vue'

const width = ref(120)
</script>

<template>
  <NumberFieldRoot
    v-slot="{ attrs, editing, actions }"
    v-model="width"
    :min="0"
    :max="1000"
    aria-label="Width"
  >
    <div v-bind="attrs" @pointerdown="!editing && actions.startScrub($event)">
      <NumberFieldLeading>W</NumberFieldLeading>
      <NumberFieldInput />
      <NumberFieldValue />
      <NumberFieldUnit>px</NumberFieldUnit>
    </div>
  </NumberFieldRoot>
</template>
```

## Compatibility

`ScrubInputRoot`, `ScrubInputField`, `ScrubInputDisplay`, and `useScrubInput()` are deprecated
aliases. They use the NumberField implementation and can be migrated without changing model or
commit semantics.
