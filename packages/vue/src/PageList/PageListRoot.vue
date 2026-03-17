<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../shared/editorContext'
import { useSceneComputed } from '../shared/useSceneComputed'

const editor = useEditor()

const pages = useSceneComputed(() => editor.graph.getPages())
const currentPageId = computed(() => editor.state.currentPageId)
</script>

<template>
  <slot
    :pages="pages"
    :current-page-id="currentPageId"
    :switch-page="editor.switchPage"
    :add-page="editor.addPage"
    :delete-page="editor.deletePage"
    :rename-page="editor.renamePage"
  />
</template>
