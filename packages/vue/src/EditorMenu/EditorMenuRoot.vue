<script setup lang="ts">
import { computed } from 'vue'

import { useEditor } from '../context'
import { useSceneComputed } from '../composables/use-scene-reactive'

import type { SceneNode } from '@open-pencil/core'

const editor = useEditor()

const selectedIds = useSceneComputed(() => editor.state.selectedIds)

const hasSelection = computed(() => selectedIds.value.size > 0)
const selectedCount = computed(() => selectedIds.value.size)

const selectedNode = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)

const selectedType = computed(() => selectedNode.value?.type ?? null)
const isInstance = computed(() => selectedType.value === 'INSTANCE')
const isComponent = computed(() => selectedType.value === 'COMPONENT')
const isGroup = computed(() => selectedType.value === 'GROUP')
const isVisible = computed(() => selectedNode.value?.visible ?? true)
const isLocked = computed(() => selectedNode.value?.locked ?? false)

const canCreateComponentSet = computed(() => {
  if (selectedIds.value.size < 2) return false
  for (const id of selectedIds.value) {
    if (editor.graph.getNode(id)?.type !== 'COMPONENT') return false
  }
  return true
})

const otherPages = computed(() =>
  editor.graph.getPages().filter((p) => p.id !== editor.state.currentPageId)
)

function ids() {
  return [...selectedIds.value]
}

function copyAsText() {
  return editor.copySelectionAsText(ids())
}

function copyAsSVG() {
  return editor.copySelectionAsSVG(ids())
}

function copyAsJSX() {
  return editor.copySelectionAsJSX(ids())
}
</script>

<template>
  <slot
    :editor="editor"
    :has-selection="hasSelection"
    :selected-count="selectedCount"
    :selected-node="selectedNode"
    :is-instance="isInstance"
    :is-component="isComponent"
    :is-group="isGroup"
    :is-visible="isVisible"
    :is-locked="isLocked"
    :can-create-component-set="canCreateComponentSet"
    :other-pages="otherPages"
    :copy-as-text="copyAsText"
    :copy-as-s-v-g="copyAsSVG"
    :copy-as-j-s-x="copyAsJSX"
  />
</template>
