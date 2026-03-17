<script setup lang="ts">
import { ref } from 'vue'

import { useEditor } from '../context'
import { useCanvas } from '../composables/use-canvas'
import { provideCanvas } from './context'

import type { UseCanvasOptions } from '../composables/use-canvas'

const props = withDefaults(defineProps<UseCanvasOptions>(), {
  showRulers: undefined
})

const editor = useEditor()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

const { renderNow, hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  editor,
  { ...props, onReady: () => { ready.value = true } }
)

provideCanvas({
  canvasRef,
  ready,
  renderNow,
  hitTestSectionTitle,
  hitTestComponentLabel,
  hitTestFrameTitle
})
</script>

<template>
  <slot
    :canvas-ref="canvasRef"
    :ready="ready"
    :render-now="renderNow"
  />
</template>
