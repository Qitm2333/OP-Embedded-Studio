<script setup lang="ts">
import { computed } from 'vue'
import {
  ColorAreaRoot,
  ColorAreaArea,
  ColorAreaThumb,
  ColorFieldRoot,
  ColorFieldInput,
  normalizeColor,
  convertToHsl,
  convertToRgb,
  type Color as RekaColor
} from 'reka-ui'

import type { Color } from '@open-pencil/core'
import { colorToCSS, colorToHex8, rgba255ToColor } from '@open-pencil/core'
import type { OkHCLControls } from '@open-pencil/vue/ColorPicker/types'

import PickerSlider from './PickerSlider.vue'

const { color, okhcl = null } = defineProps<{
  color: Color
  okhcl?: OkHCLControls | null
}>()

const emit = defineEmits<{
  update: [color: Color]
}>()

const hexWithAlpha = computed(() => colorToHex8(color))
const rekaColor = computed(() => normalizeColor(hexWithAlpha.value))
const isOkHCLMode = computed(() => okhcl?.model === 'okhcl' && okhcl.okhcl)
const previewStyle = computed(() => ({ background: colorToCSS(color) }))
const hslColor = computed(() => convertToHsl(rekaColor.value))
const rgbaHue = computed(() => hslColor.value.h ?? 0)

function rekaToColor(c: RekaColor): Color {
  const rgb = convertToRgb(c)
  return rgba255ToColor(rgb.r, rgb.g, rgb.b, rgb.alpha)
}

function onRekaColorUpdate(c: RekaColor) {
  emit('update', rekaToColor(c))
}

function onHexUpdate(hex: string) {
  emit('update', rekaToColor(normalizeColor(hex)))
}

function updateAlphaPercent(value: number) {
  emit('update', {
    ...color,
    a: Math.max(0, Math.min(1, value / 100))
  })
}

function updateRGBAHue(value: number) {
  onRekaColorUpdate(
    normalizeColor({
      ...hslColor.value,
      h: value
    })
  )
}

function updateRGBAAlpha(value: number) {
  emit('update', {
    ...color,
    a: Math.max(0, Math.min(1, value))
  })
}

function toPercent(value: number) {
  return Math.round(value * 100)
}

function fromPercent(value: number) {
  return Math.max(0, Math.min(1, value / 100))
}

function updateOkHCLChannel(channel: 'h' | 'c' | 'l' | 'a', value: number) {
  okhcl?.updateOkHCL({ [channel]: value })
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="okhcl" class="flex items-center gap-1">
      <button
        v-for="option in okhcl.modelOptions"
        :key="option.value"
        type="button"
        class="rounded border px-2 py-0.5 text-[11px]"
        :class="
          okhcl.model === option.value
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-border bg-input text-muted'
        "
        @click="okhcl.setModel(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <template v-if="isOkHCLMode">
      <div class="h-10 rounded border border-border" :style="previewStyle" />

      <div class="flex flex-col gap-2">
        <PickerSlider
          label="H"
          :model-value="okhcl!.okhcl!.h"
          :min="0"
          :max="360"
          :step="1"
          gradient-style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
          @update:model-value="updateOkHCLChannel('h', $event)"
        />

        <PickerSlider
          label="C"
          :model-value="okhcl!.okhcl!.c"
          :min="0"
          :max="0.4"
          :step="0.001"
          :display-value="toPercent(okhcl!.okhcl!.c)"
          :display-min="0"
          :display-max="40"
          :display-step="1"
          :parse-display="(value) => value / 100"
          gradient-style="background: linear-gradient(to right, #3a3a3a, var(--color-accent));"
          @update:model-value="updateOkHCLChannel('c', $event)"
        />

        <PickerSlider
          label="L"
          :model-value="okhcl!.okhcl!.l"
          :min="0"
          :max="1"
          :step="0.001"
          :display-value="toPercent(okhcl!.okhcl!.l)"
          :display-min="0"
          :display-max="100"
          :display-step="1"
          :parse-display="fromPercent"
          gradient-style="background: linear-gradient(to right, #000000, #888888, #ffffff);"
          @update:model-value="updateOkHCLChannel('l', $event)"
        />

        <PickerSlider
          label="A"
          :model-value="okhcl!.okhcl!.a ?? 1"
          :min="0"
          :max="1"
          :step="0.001"
          :display-value="toPercent(okhcl!.okhcl!.a ?? 1)"
          :display-min="0"
          :display-max="100"
          :display-step="1"
          :parse-display="fromPercent"
          checkerboard
          :gradient-style="`background: linear-gradient(to right, transparent, ${colorToCSS(color)})`"
          :thumb-fill="colorToCSS(color)"
          @update:model-value="updateOkHCLChannel('a', $event)"
        />
      </div>

      <p class="text-[10px] text-muted">H = hue, C = chroma, L = lightness, A = alpha</p>
    </template>

    <template v-else>
      <ColorAreaRoot
        v-slot="{ style }"
        :model-value="rekaColor"
        color-space="hsb"
        x-channel="saturation"
        y-channel="brightness"
        @update:color="onRekaColorUpdate"
      >
        <ColorAreaArea
          class="relative h-[140px] w-full cursor-crosshair overflow-hidden rounded"
          :style="style"
        >
          <ColorAreaThumb
            class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
          />
        </ColorAreaArea>
      </ColorAreaRoot>

      <PickerSlider
        label="H"
        :model-value="rgbaHue"
        :min="0"
        :max="360"
        :step="1"
        gradient-style="background: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
        :thumb-fill="colorToCSS(color)"
        :ui="{ root: 'gap-0', label: 'hidden', input: 'hidden' }"
        @update:model-value="updateRGBAHue"
      />

      <PickerSlider
        label="A"
        :model-value="color.a"
        :min="0"
        :max="1"
        :step="0.001"
        checkerboard
        :gradient-style="`background: linear-gradient(to right, transparent, ${colorToCSS({ ...color, a: 1 })})`"
        :thumb-fill="colorToCSS(color)"
        :ui="{ root: 'gap-0', label: 'hidden', input: 'hidden' }"
        @update:model-value="updateRGBAAlpha"
      />

      <div class="flex items-center gap-1">
        <span class="text-[11px] text-muted">#</span>
        <ColorFieldRoot
          :model-value="hexWithAlpha"
          class="min-w-0 flex-1"
          @update:model-value="onHexUpdate"
        >
          <ColorFieldInput
            class="w-full rounded border border-border bg-input px-1.5 py-0.5 font-mono text-xs text-surface"
          />
        </ColorFieldRoot>
        <input
          type="number"
          class="w-10 rounded border border-border bg-input px-1 py-0.5 text-right text-xs text-surface"
          :value="Math.round(color.a * 100)"
          min="0"
          max="100"
          @change="updateAlphaPercent(+($event.target as HTMLInputElement).value)"
        />
        <span class="text-[11px] text-muted">%</span>
      </div>
    </template>
  </div>
</template>
