<script setup lang="ts">
import { ref, type Component, type Ref } from 'vue'
import { TreeItem } from 'reka-ui'

import { nodeIcon, COMPONENT_TYPES } from '@/utils/layer-icons'
import type { EditorStore } from '@/stores/editor'
import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'

interface LayerNode {
  id: string
  name: string
  type: string
  layoutMode: string
  visible: boolean
  locked: boolean
}

type TreeInstruction = Extract<
  Instruction,
  { type: 'reorder-above' | 'reorder-below' | 'make-child' }
>

const {
  itemValue,
  level,
  hasChildren,
  rename,
  store,
  draggingId,
  instruction,
  instructionTargetId,
  indentPerLevel,
  setupItem
} = defineProps<{
  itemValue: LayerNode
  level: number
  hasChildren: boolean
  rename: {
    editingId: Ref<string | null>
    focusInput: (el: HTMLInputElement | null) => void
    start: (id: string, name: string) => void
    commit: (id: string, el: HTMLInputElement) => void
    onKeydown: (e: KeyboardEvent) => void
  }
  store: EditorStore
  draggingId: string | null
  instruction: TreeInstruction | null
  instructionTargetId: string | null
  indentPerLevel: number
  setupItem: (
    el: Ref<HTMLElement | null>,
    item: () => { id: string; level: number; hasChildren: boolean; parentId: string | null }
  ) => void
}>()

const emit = defineEmits<{
  select: [ev: CustomEvent]
  toggleExpand: [id: string]
}>()

const rowEl = ref<HTMLElement | null>(null)

setupItem(rowEl, () => ({
  id: itemValue.id,
  level,
  hasChildren,
  parentId: store.graph.getNode(itemValue.id)?.parentId ?? null
}))

defineExpose({ rowEl })

const icon = nodeIcon(itemValue) as Component
const isComponent = COMPONENT_TYPES.has(itemValue.type)
const isTarget = () => instructionTargetId === itemValue.id
const padLeft = `${8 + (level - 1) * indentPerLevel}px`
</script>

<template>
  <div ref="rowEl" :data-node-id="itemValue.id">
    <TreeItem
      v-slot="{ isExpanded }"
      :value="itemValue"
      :level="level"
      as-child
      @select="emit('select', $event)"
      @toggle="
        (e: CustomEvent) => {
          if (e.detail.originalEvent?.type === 'click') e.preventDefault()
        }
      "
    >
      <!-- Rename input -->
      <div
        v-if="rename.editingId.value === itemValue.id"
        class="flex w-full items-center gap-1 py-1"
        :style="{ paddingLeft: padLeft }"
      >
        <span
          v-if="hasChildren"
          class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
          :class="isExpanded ? 'rotate-90' : 'rotate-0'"
          @click.stop="emit('toggleExpand', itemValue.id)"
        >
          <icon-lucide-chevron-right class="size-3" />
        </span>
        <span v-else class="w-4 shrink-0" />
        <component :is="icon" class="size-3 shrink-0 opacity-70" />
        <input
          :ref="
            (el) => {
              if (el) rename.focusInput(el as HTMLInputElement)
            }
          "
          data-layer-edit
          data-test-id="layers-item-input"
          class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0 text-xs text-surface outline-none"
          :value="itemValue.name"
          @blur="rename.commit(itemValue.id, $event.target as HTMLInputElement)"
          @keydown="rename.onKeydown"
        />
      </div>

      <!-- Normal row -->
      <button
        v-else
        data-test-id="layers-item"
        class="group/row relative flex w-full cursor-pointer items-center gap-1 rounded border-none py-1 pr-1 text-left text-xs"
        :class="[
          store.state.selectedIds.has(itemValue.id)
            ? 'bg-accent text-white'
            : 'bg-transparent text-surface hover:bg-hover',
          draggingId === itemValue.id ? 'opacity-30' : '',
          isTarget() && instruction?.type === 'make-child' ? 'ring-2 ring-accent ring-inset' : '',
          !itemValue.visible ? 'opacity-50' : ''
        ]"
        :style="{ paddingLeft: padLeft }"
        @dblclick="rename.start(itemValue.id, itemValue.name)"
      >
        <span
          v-if="hasChildren"
          class="flex w-4 shrink-0 cursor-pointer items-center justify-center text-muted transition-transform hover:text-surface"
          :class="isExpanded ? 'rotate-90' : 'rotate-0'"
          @click.stop="emit('toggleExpand', itemValue.id)"
        >
          <icon-lucide-chevron-right class="size-3" />
        </span>
        <span v-else class="w-4 shrink-0" />

        <component
          :is="icon"
          class="size-3 shrink-0"
          :class="isComponent ? 'text-component opacity-100' : 'opacity-70'"
        />

        <span class="min-w-0 flex-1 truncate">{{ itemValue.name }}</span>

        <!-- Lock + visibility -->
        <span
          class="flex shrink-0 items-center gap-0.5"
          :class="
            !itemValue.locked && itemValue.visible ? 'opacity-0 group-hover/row:opacity-100' : ''
          "
        >
          <span
            class="flex size-4 items-center justify-center rounded hover:bg-white/15"
            :title="itemValue.locked ? 'Unlock' : 'Lock'"
            @pointerdown.stop
            @click.stop="store.toggleNodeLock(itemValue.id)"
          >
            <icon-lucide-lock
              v-if="itemValue.locked"
              class="size-3"
              :class="store.state.selectedIds.has(itemValue.id) ? 'text-white' : 'text-surface'"
            />
            <icon-lucide-unlock
              v-else
              class="size-3 opacity-0 group-hover/row:opacity-100"
              :class="
                store.state.selectedIds.has(itemValue.id) ? 'text-white/80' : 'text-surface/70'
              "
            />
          </span>
          <span
            class="flex size-4 items-center justify-center rounded hover:bg-white/15"
            :title="itemValue.visible ? 'Hide' : 'Show'"
            @pointerdown.stop
            @click.stop="store.toggleNodeVisibility(itemValue.id)"
          >
            <icon-lucide-eye-off
              v-if="!itemValue.visible"
              class="size-3"
              :class="store.state.selectedIds.has(itemValue.id) ? 'text-white' : 'text-surface'"
            />
            <icon-lucide-eye
              v-else
              class="size-3 opacity-0 group-hover/row:opacity-100"
              :class="
                store.state.selectedIds.has(itemValue.id) ? 'text-white/80' : 'text-surface/70'
              "
            />
          </span>
        </span>

        <!-- Drop indicators -->
        <div
          v-if="isTarget() && instruction && instruction.type !== 'make-child'"
          class="pointer-events-none absolute h-0.5 bg-accent"
          :class="{
            'bottom-0': instruction.type === 'reorder-below',
            'top-0': instruction.type === 'reorder-above'
          }"
          :style="{
            left: `${(level - 1) * indentPerLevel}px`,
            width: `calc(100% - ${(level - 1) * indentPerLevel}px)`
          }"
        />
      </button>
    </TreeItem>
  </div>
</template>
