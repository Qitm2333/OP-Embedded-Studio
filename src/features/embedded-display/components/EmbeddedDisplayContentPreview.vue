<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CSSProperties } from 'vue'

import type { EmbeddedImagePlacement } from '../adapters/image'

const {
  src,
  alt,
  placement,
  backgroundColor,
  targetWidth,
  targetHeight,
  sourceWidth = 0,
  sourceHeight = 0,
  round = false
} = defineProps<{
  src: string
  alt: string
  placement: EmbeddedImagePlacement
  backgroundColor: string
  targetWidth: number
  targetHeight: number
  sourceWidth?: number
  sourceHeight?: number
  round?: boolean
}>()

const naturalWidth = ref(0)
const naturalHeight = ref(0)
const previewStyle = computed<CSSProperties>(() => ({
  aspectRatio: `${Math.max(1, targetWidth)} / ${Math.max(1, targetHeight)}`,
  backgroundColor,
  borderRadius: round ? '9999px' : undefined
}))
const imageStyle = computed<CSSProperties>(() => {
  if (placement === 'stretch') {
    return { inset: '0', width: '100%', height: '100%', objectFit: 'fill' }
  }
  if (placement === 'contain') {
    return { inset: '0', width: '100%', height: '100%', objectFit: 'contain' }
  }

  const width = sourceWidth || naturalWidth.value || targetWidth
  const height = sourceHeight || naturalHeight.value || targetHeight
  return {
    left: '50%',
    top: '50%',
    width: `${(width / Math.max(1, targetWidth)) * 100}%`,
    height: `${(height / Math.max(1, targetHeight)) * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
    objectFit: 'fill',
    imageRendering: 'pixelated',
    transform: 'translate(-50%, -50%)'
  }
})

function handleLoad(event: Event): void {
  const image = event.currentTarget as HTMLImageElement
  naturalWidth.value = image.naturalWidth
  naturalHeight.value = image.naturalHeight
}
</script>

<template>
  <div
    class="relative self-start shrink-0 overflow-hidden border border-border bg-black"
    :style="previewStyle"
  >
    <img
      :src="src"
      :alt="alt"
      class="absolute block"
      :style="imageStyle"
      @load="handleLoad"
    />
  </div>
</template>
