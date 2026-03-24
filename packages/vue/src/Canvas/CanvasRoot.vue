<script setup lang="ts">
import { ref } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useCanvas } from '@open-pencil/vue/shared/useCanvas'
import { provideCanvas } from './context'

import type { UseCanvasOptions } from '@open-pencil/vue/shared/useCanvas'

const props = withDefaults(defineProps<UseCanvasOptions>(), {
  showRulers: undefined
})

const editor = useEditor()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

const { renderNow, hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
  canvasRef,
  editor,
  {
    ...props,
    onReady: () => {
      ready.value = true
    }
  }
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
  <slot :canvas-ref="canvasRef" :ready="ready" :render-now="renderNow" />
</template>
