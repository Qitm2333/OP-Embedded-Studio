<script setup lang="ts">
import { ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal } from 'reka-ui'

import { useEditorStore } from '@/stores/editor'
import NodeContextMenuContent from './NodeContextMenuContent.vue'

const store = useEditorStore()

function onRightClick(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const canvas = el.querySelector('canvas')
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const sx = e.clientX - rect.left
  const sy = e.clientY - rect.top
  const { x: cx, y: cy } = store.screenToCanvas(sx, sy)

  let hit = null
  const scopeId = store.state.enteredContainerId
  if (scopeId && store.graph.getNode(scopeId)) {
    const abs = store.graph.getAbsolutePosition(scopeId)
    hit = store.graph.hitTest(cx - abs.x, cy - abs.y, scopeId)
  }
  if (!hit) {
    hit = store.graph.hitTest(cx, cy, store.state.currentPageId)
  }
  if (hit) {
    if (!store.state.selectedIds.has(hit.id)) {
      store.select([hit.id])
    }
  } else {
    store.clearSelection()
  }
}
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="onRightClick">
      <slot />
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <NodeContextMenuContent />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
