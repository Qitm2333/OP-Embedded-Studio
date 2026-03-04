<script setup lang="ts">
import { computed } from 'vue'

import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'
import { useMultiProps } from '@/composables/use-multi-props'

import type { Color, Stroke } from '@/engine/scene-graph'

const { store } = useNodeProps()
const { nodes, isMulti, active, activeNode } = useMultiProps()

const strokesAreMixed = computed(() => {
  if (!isMulti.value) return false
  const all = nodes.value
  const first = JSON.stringify(all[0].strokes)
  return all.some((n) => JSON.stringify(n.strokes) !== first)
})

function updateColor(index: number, color: Color) {
  for (const n of isMulti.value ? nodes.value : [activeNode.value]) {
    if (!n) continue
    const strokes = [...n.strokes]
    strokes[index] = { ...strokes[index], color }
    store.updateNodeWithUndo(n.id, { strokes }, 'Change stroke')
  }
}

function updateWeight(index: number, weight: number) {
  for (const n of isMulti.value ? nodes.value : [activeNode.value]) {
    if (!n) continue
    const strokes = [...n.strokes]
    strokes[index] = { ...strokes[index], weight }
    store.updateNodeWithUndo(n.id, { strokes }, 'Change stroke')
  }
}

function updateOpacity(index: number, opacity: number) {
  for (const n of isMulti.value ? nodes.value : [activeNode.value]) {
    if (!n) continue
    const strokes = [...n.strokes]
    strokes[index] = { ...strokes[index], opacity: Math.max(0, Math.min(1, opacity / 100)) }
    store.updateNodeWithUndo(n.id, { strokes }, 'Change stroke')
  }
}

function toggleVisibility(index: number) {
  for (const n of isMulti.value ? nodes.value : [activeNode.value]) {
    if (!n) continue
    const strokes = [...n.strokes]
    strokes[index] = { ...strokes[index], visible: !strokes[index].visible }
    store.updateNodeWithUndo(n.id, { strokes }, 'Change stroke')
  }
}

function add() {
  const stroke: Stroke = {
    color: { r: 0, g: 0, b: 0, a: 1 },
    weight: 1,
    opacity: 1,
    visible: true,
    align: 'CENTER'
  }
  if (isMulti.value) {
    for (const n of nodes.value) {
      store.updateNodeWithUndo(n.id, { strokes: [stroke] }, 'Set stroke')
    }
    store.requestRender()
  } else {
    const n = activeNode.value
    if (!n) return
    store.updateNodeWithUndo(n.id, { strokes: [...n.strokes, stroke] }, 'Add stroke')
  }
}

function remove(index: number) {
  for (const n of isMulti.value ? nodes.value : [activeNode.value]) {
    if (!n) continue
    store.updateNodeWithUndo(
      n.id,
      { strokes: n.strokes.filter((_, i) => i !== index) },
      'Remove stroke'
    )
  }
}
</script>

<template>
  <div v-if="active" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1 block text-[11px] text-muted">Stroke</label>
      <button
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="add"
      >
        +
      </button>
    </div>
    <p v-if="strokesAreMixed" class="text-[11px] text-muted">Click + to replace mixed strokes</p>
    <div
      v-for="(stroke, i) in strokesAreMixed ? [] : (activeNode?.strokes ?? [])"
      :key="i"
      class="group flex items-center gap-1.5 py-0.5"
    >
      <ColorInput :color="stroke.color" editable @update="updateColor(i, $event)" />
      <ScrubInput
        class="w-12"
        suffix="%"
        :model-value="Math.round(stroke.opacity * 100)"
        :min="0"
        :max="100"
        @update:model-value="updateOpacity(i, $event)"
      />
      <button
        class="cursor-pointer border-none bg-transparent p-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-surface"
        @click="toggleVisibility(i)"
      >
        <icon-lucide-eye v-if="stroke.visible" class="size-3.5" />
        <icon-lucide-eye-off v-else class="size-3.5" />
      </button>
      <button
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="remove(i)"
      >
        −
      </button>
    </div>
    <div
      v-if="!strokesAreMixed && (activeNode?.strokes?.length ?? 0) > 0"
      class="mt-1 flex items-center gap-1.5"
    >
      <ScrubInput
        class="w-16"
        icon="W"
        :model-value="activeNode?.strokes[0].weight ?? 1"
        :min="0"
        @update:model-value="updateWeight(0, $event)"
      />
    </div>
  </div>
</template>
