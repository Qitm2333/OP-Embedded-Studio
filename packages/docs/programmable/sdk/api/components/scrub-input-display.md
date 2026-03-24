---
title: ScrubInputDisplay
description: Read-only display primitive for ScrubInputRoot non-editing mode.
---

# ScrubInputDisplay

`ScrubInputDisplay` renders the non-editing display for `ScrubInputRoot`.

It only renders while the scrub input is not in editing mode.

## Usage

Use it inside a `ScrubInputRoot` subtree.

## Props and attrs

<SdkFieldGroup>
  <SdkField name="$attrs" type="span attributes">Passed through to the rendered span element.</SdkField>
</SdkFieldGroup>

## Example

```vue
<ScrubInputRoot v-model:model-value="value">
  <ScrubInputDisplay class="cursor-ew-resize" />
</ScrubInputRoot>
```

## Related APIs

- [ScrubInputRoot](./scrub-input-root)
- [ScrubInputField](./scrub-input-field)
