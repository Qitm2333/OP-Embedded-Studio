<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'

const { store, node, nodes, updateProp, commitProp } = useNodeProps()

type HAlign = 'left' | 'center' | 'right'
type VAlign = 'top' | 'center' | 'bottom'

function alignHorizontal(align: HAlign) {
  const selected = nodes.value
  if (selected.length === 0) return

  let minX: number, maxX: number

  if (selected.length === 1) {
    const parent = store.graph.getNode(selected[0].parentId ?? '')
    if (!parent) return
    minX = 0
    maxX = parent.width
  } else {
    minX = Infinity
    maxX = -Infinity
    for (const n of selected) {
      const abs = store.graph.getAbsolutePosition(n.id)
      minX = Math.min(minX, abs.x)
      maxX = Math.max(maxX, abs.x + n.width)
    }
  }

  for (const n of selected) {
    let targetX: number
    if (selected.length === 1) {
      if (align === 'left') targetX = minX
      else if (align === 'right') targetX = maxX - n.width
      else targetX = (minX + maxX) / 2 - n.width / 2
      store.updateNode(n.id, { x: targetX })
    } else {
      const abs = store.graph.getAbsolutePosition(n.id)
      if (align === 'left') targetX = minX
      else if (align === 'right') targetX = maxX - n.width
      else targetX = (minX + maxX) / 2 - n.width / 2
      store.updateNode(n.id, { x: n.x + (targetX - abs.x) })
    }
  }
  store.requestRender()
}

function alignVertical(align: VAlign) {
  const selected = nodes.value
  if (selected.length === 0) return

  let minY: number, maxY: number

  if (selected.length === 1) {
    const parent = store.graph.getNode(selected[0].parentId ?? '')
    if (!parent) return
    minY = 0
    maxY = parent.height
  } else {
    minY = Infinity
    maxY = -Infinity
    for (const n of selected) {
      const abs = store.graph.getAbsolutePosition(n.id)
      minY = Math.min(minY, abs.y)
      maxY = Math.max(maxY, abs.y + n.height)
    }
  }

  for (const n of selected) {
    let targetY: number
    if (selected.length === 1) {
      if (align === 'top') targetY = minY
      else if (align === 'bottom') targetY = maxY - n.height
      else targetY = (minY + maxY) / 2 - n.height / 2
      store.updateNode(n.id, { y: targetY })
    } else {
      const abs = store.graph.getAbsolutePosition(n.id)
      if (align === 'top') targetY = minY
      else if (align === 'bottom') targetY = maxY - n.height
      else targetY = (minY + maxY) / 2 - n.height / 2
      store.updateNode(n.id, { y: n.y + (targetY - abs.y) })
    }
  }
  store.requestRender()
}

function flipHorizontal() {
  const n = node.value
  store.updateNodeWithUndo(n.id, { flipX: !n.flipX }, 'Flip horizontal')
  store.requestRender()
}

function flipVertical() {
  const n = node.value
  store.updateNodeWithUndo(n.id, { flipY: !n.flipY }, 'Flip vertical')
  store.requestRender()
}

function rotate90() {
  const n = node.value
  store.updateNodeWithUndo(n.id, { rotation: (n.rotation + 90) % 360 }, 'Rotate 90°')
  store.requestRender()
}
</script>

<template>
  <div v-if="node" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Position</label>

    <!-- Alignment buttons -->
    <div class="mb-1.5 flex gap-2">
      <div class="flex gap-0.5">
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          title="Align left"
          @click="alignHorizontal('left')"
        >
          <icon-lucide-align-horizontal-justify-start class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          title="Align center horizontally"
          @click="alignHorizontal('center')"
        >
          <icon-lucide-align-horizontal-justify-center class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          title="Align right"
          @click="alignHorizontal('right')"
        >
          <icon-lucide-align-horizontal-justify-end class="size-3.5" />
        </button>
      </div>
      <div class="flex gap-0.5">
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          title="Align top"
          @click="alignVertical('top')"
        >
          <icon-lucide-align-vertical-justify-start class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          title="Align center vertically"
          @click="alignVertical('center')"
        >
          <icon-lucide-align-vertical-justify-center class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          title="Align bottom"
          @click="alignVertical('bottom')"
        >
          <icon-lucide-align-vertical-justify-end class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- X / Y -->
    <div class="flex gap-1.5">
      <ScrubInput
        icon="X"
        :model-value="Math.round(node.x)"
        @update:model-value="updateProp('x', $event)"
        @commit="(v: number, p: number) => commitProp('x', v, p)"
      />
      <ScrubInput
        icon="Y"
        :model-value="Math.round(node.y)"
        @update:model-value="updateProp('y', $event)"
        @commit="(v: number, p: number) => commitProp('y', v, p)"
      />
    </div>

    <!-- Rotation + flip -->
    <div class="mt-1.5 flex items-center gap-1.5">
      <ScrubInput
        class="flex-1"
        suffix="°"
        :model-value="Math.round(node.rotation)"
        :min="-360"
        :max="360"
        @update:model-value="updateProp('rotation', $event)"
        @commit="(v: number, p: number) => commitProp('rotation', v, p)"
      >
        <template #icon>
          <icon-lucide-rotate-ccw class="size-3" />
        </template>
      </ScrubInput>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        title="Flip horizontal"
        @click="flipHorizontal"
      >
        <icon-lucide-flip-horizontal class="size-3.5" />
      </button>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        title="Flip vertical"
        @click="flipVertical"
      >
        <icon-lucide-flip-vertical class="size-3.5" />
      </button>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        title="Rotate 90°"
        @click="rotate90"
      >
        <icon-lucide-rotate-cw class="size-3.5" />
      </button>
    </div>
  </div>
</template>
