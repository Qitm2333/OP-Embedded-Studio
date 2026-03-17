<script setup lang="ts">
import { computed } from 'vue'
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
  <slot
    :fill="fill"
    :category="category"
    :swatch-bg="swatchBg"
    :to-solid="toSolid"
    :to-gradient="toGradient"
    :to-image="toImage"
  />
</template>
