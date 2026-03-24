---
title: ScrubInputField
description: Input element primitive for ScrubInputRoot editing mode.
---

# ScrubInputField

`ScrubInputField` renders the editable input element for `ScrubInputRoot`.

It only renders while the scrub input is in editing mode.

## Usage

Use it inside a `ScrubInputRoot` subtree.

## Props and attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="input attributes">Passed through to the rendered input element.</SdkField>
</SdkFieldGroup>

## Example

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputField class="w-16" />
</ScrubInputRoot>
```

## Related APIs

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputDisplay](./scrub-input-display)
