<script setup lang="ts">
import { ref } from 'vue'

import { useEditor } from '../context'
import { useCanvas } from '../composables/use-canvas'

import type { UseCanvasOptions } from '../composables/use-canvas'

const props = withDefaults(defineProps<UseCanvasOptions>(), {
  showRulers: undefined
})

const editor = useEditor()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const canvas = useCanvas(canvasRef, editor, props)

defineExpose({ canvasRef, editor, ...canvas })
</script>

<template>
  <canvas ref="canvasRef" style="width: 100%; height: 100%; display: block" />
</template>
