<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../context'

const editor = useEditor()

const layers = computed(() => editor.getLayerTree())
const selectedIds = computed(() => editor.state.selectedIds)
</script>

<template>
  <slot
    :layers="layers"
    :selected-ids="selectedIds"
    :select="editor.select"
    :toggle-visibility="editor.toggleVisibility"
    :toggle-lock="editor.toggleLock"
    :rename-node="editor.renameNode"
    :delete-selected="editor.deleteSelected"
  />
</template>
