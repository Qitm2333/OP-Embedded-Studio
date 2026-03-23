<script setup lang="ts">
import { type Component } from 'vue'

import { useVariablesEditor } from '../shared/use-variables-editor'

const props = defineProps<{
  colorInput: Component
  icons: Record<string, Component>
  fallbackIcon: Component
  deleteIcon: Component
}>()

const ctx = useVariablesEditor({
  colorInput: props.colorInput,
  icons: props.icons,
  fallbackIcon: props.fallbackIcon,
  deleteIcon: props.deleteIcon
})
</script>

<template>
  <slot
    :collections="ctx.collections"
    :variables="ctx.variables"
    :active-collection-id="ctx.activeCollectionId"
    :active-modes="ctx.activeModes"
    :search-term="ctx.searchTerm"
    :editing-collection-id="ctx.editingCollectionId"
    :table="ctx.table"
    :has-collections="ctx.hasCollections"
    :add-collection="ctx.addCollection"
    :add-variable="ctx.addVariable"
    :set-collection-input-ref="ctx.setCollectionInputRef"
    :start-rename-collection="ctx.startRenameCollection"
    :commit-rename-collection="ctx.commitRenameCollection"
  />
</template>
