---
title: ScrubInputField
description: Deprecated compatibility alias for NumberFieldInput.
---

# ScrubInputField

::: warning Deprecated
Use [`NumberFieldInput`](./number-field). `ScrubInputField` is an alias backed by the NumberField
implementation.
:::

The editing element now uses `type="text"` and `inputmode="decimal"` so it can accept safe numeric
expressions while preserving spinbutton ARIA and keyboard behavior.
