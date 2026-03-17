<script setup lang="ts">
import { computed } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { twMerge } from 'tailwind-merge'

import GradientEditor from './GradientEditor.vue'
import HsvColorArea from './HsvColorArea.vue'
import ImageFillPicker from './ImageFillPicker.vue'
import { colorToCSS } from '@open-pencil/core'

import type { Fill, GradientStop } from '@open-pencil/core'

type FillCategory = 'SOLID' | 'GRADIENT' | 'IMAGE'

const FILL_CATEGORY: Record<string, FillCategory> = {
  SOLID: 'SOLID',
  GRADIENT_LINEAR: 'GRADIENT',
  GRADIENT_RADIAL: 'GRADIENT',
  GRADIENT_ANGULAR: 'GRADIENT',
  GRADIENT_DIAMOND: 'GRADIENT',
  IMAGE: 'IMAGE'
}

const TAB_BASE =
  'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 transition-colors'

function tabClass(active: boolean) {
  return twMerge(
    TAB_BASE,
    active ? 'bg-hover text-surface' : 'text-muted hover:bg-hover hover:text-surface'
  )
}

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()

const category = computed(() => FILL_CATEGORY[fill.type] ?? 'SOLID')

function toSolid() {
  if (category.value === 'SOLID') return
  const color = fill.gradientStops?.[0]?.color ?? fill.color
  emit('update', { ...fill, type: 'SOLID', color: { ...color } })
}

function toGradient() {
  if (category.value === 'GRADIENT') return
  const stops: GradientStop[] = fill.gradientStops?.length
    ? fill.gradientStops
    : [
        { color: { ...fill.color }, position: 0 },
        { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
      ]
  emit('update', {
    ...fill,
    type: 'GRADIENT_LINEAR',
    gradientStops: stops,
    gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
  })
}

function toImage() {
  if (category.value === 'IMAGE') return
  emit('update', { ...fill, type: 'IMAGE' })
}

function gradientCSS(stops: GradientStop[]): string {
  return stops.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')
}

const swatchBg = computed(() => {
  if (category.value === 'GRADIENT' && fill.gradientStops?.length)
    return `linear-gradient(to right, ${gradientCSS(fill.gradientStops)})`
  return colorToCSS(fill.color)
})
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <button
        data-test-id="fill-picker-swatch"
        class="size-5 shrink-0 cursor-pointer rounded border border-border p-0"
        :style="{ background: swatchBg }"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        class="z-[100] w-60 rounded-lg border border-border bg-panel p-2 shadow-xl"
        :side-offset="4"
        side="left"
      >
        <div class="mb-2 flex items-center gap-0.5">
          <button
            :class="tabClass(category === 'SOLID')"
            data-test-id="fill-picker-tab-solid"
            title="Solid"
            @click="toSolid"
          >
            <icon-lucide-square class="size-3.5" />
          </button>
          <button
            :class="tabClass(category === 'GRADIENT')"
            data-test-id="fill-picker-tab-gradient"
            title="Gradient"
            @click="toGradient"
          >
            <icon-lucide-blend class="size-3.5" />
          </button>
          <button
            :class="tabClass(category === 'IMAGE')"
            data-test-id="fill-picker-tab-image"
            title="Image"
            @click="toImage"
          >
            <icon-lucide-image class="size-3.5" />
          </button>
        </div>

        <HsvColorArea
          v-if="category === 'SOLID'"
          :color="fill.color"
          @update="emit('update', { ...fill, color: $event })"
        />

        <GradientEditor
          v-if="category === 'GRADIENT'"
          :fill="fill"
          @update="emit('update', $event)"
        />

        <ImageFillPicker
          v-if="category === 'IMAGE'"
          :fill="fill"
          @update="emit('update', $event)"
        />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
