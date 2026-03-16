<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../context'

const editor = useEditor()

const activeTool = computed(() => editor.state.activeTool)
</script>

<template>
  <slot :active-tool="activeTool" :set-tool="editor.setTool" />
</template>
