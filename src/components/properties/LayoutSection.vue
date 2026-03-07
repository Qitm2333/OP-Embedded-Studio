<script setup lang="ts">
import { computed, ref } from 'vue'

import AppSelect from '@/components/AppSelect.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'

import type { SceneNode, LayoutSizing, LayoutAlign, LayoutCounterAlign } from '@open-pencil/core'

const { store, node, updateProp, commitProp } = useNodeProps()

const showIndividualPadding = ref(false)

const isInAutoLayout = computed(() => {
  if (!node.value.parentId) return false
  const parent = store.graph.getNode(node.value.parentId)
  return parent ? parent.layoutMode !== 'NONE' : false
})

const widthSizing = computed<LayoutSizing>(() => {
  if (node.value.layoutMode !== 'NONE') {
    return node.value.layoutMode === 'HORIZONTAL'
      ? node.value.primaryAxisSizing
      : node.value.counterAxisSizing
  }
  if (isInAutoLayout.value && node.value.layoutGrow > 0) return 'FILL'
  return 'FIXED'
})

const heightSizing = computed<LayoutSizing>(() => {
  if (node.value.layoutMode !== 'NONE') {
    return node.value.layoutMode === 'VERTICAL'
      ? node.value.primaryAxisSizing
      : node.value.counterAxisSizing
  }
  if (isInAutoLayout.value && node.value.layoutAlignSelf === 'STRETCH') return 'FILL'
  return 'FIXED'
})

function setWidthSizing(sizing: LayoutSizing) {
  if (node.value.layoutMode !== 'NONE') {
    if (node.value.layoutMode === 'HORIZONTAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutGrow', sizing === 'FILL' ? 1 : 0)
  }
}

function setHeightSizing(sizing: LayoutSizing) {
  if (node.value.layoutMode !== 'NONE') {
    if (node.value.layoutMode === 'VERTICAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutAlignSelf', sizing === 'FILL' ? 'STRETCH' : 'AUTO')
  }
}

function hasUniformPadding() {
  return (
    node.value.paddingTop === node.value.paddingRight &&
    node.value.paddingRight === node.value.paddingBottom &&
    node.value.paddingBottom === node.value.paddingLeft
  )
}

function setUniformPadding(v: number) {
  store.updateNode(node.value.id, {
    paddingTop: v,
    paddingRight: v,
    paddingBottom: v,
    paddingLeft: v
  })
}

function commitUniformPadding(_value: number, previous: number) {
  store.commitNodeUpdate(
    node.value.id,
    {
      paddingTop: previous,
      paddingRight: previous,
      paddingBottom: previous,
      paddingLeft: previous
    } as unknown as Partial<SceneNode>,
    'Change padding'
  )
}

const widthSizingOptions = computed(() => {
  const options: { value: LayoutSizing; label: string }[] = [
    { value: 'FIXED', label: `Fixed width (${Math.round(node.value.width)})` }
  ]
  if (node.value.layoutMode !== 'NONE') options.push({ value: 'HUG', label: 'Hug contents' })
  if (isInAutoLayout.value) options.push({ value: 'FILL', label: 'Fill container' })
  return options
})

const heightSizingOptions = computed(() => {
  const options: { value: LayoutSizing; label: string }[] = [
    { value: 'FIXED', label: `Fixed height (${Math.round(node.value.height)})` }
  ]
  if (node.value.layoutMode !== 'NONE') options.push({ value: 'HUG', label: 'Hug contents' })
  if (isInAutoLayout.value) options.push({ value: 'FILL', label: 'Fill container' })
  return options
})

const ALIGN_GRID: Array<{ primary: LayoutAlign; counter: LayoutCounterAlign }> = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MAX' }
]

function setAlignment(primary: LayoutAlign, counter: LayoutCounterAlign) {
  store.updateNodeWithUndo(
    node.value.id,
    { primaryAxisAlign: primary, counterAxisAlign: counter },
    'Change alignment'
  )
}
</script>

<template>
  <div v-if="node" data-test-id="layout-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Layout</label>
    <div class="flex gap-1.5">
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <ScrubInput
          icon="W"
          :model-value="Math.round(node.width)"
          :min="0"
          @update:model-value="updateProp('width', $event)"
          @commit="(v: number, p: number) => commitProp('width', v, p)"
        />
        <AppSelect
          v-if="node.layoutMode !== 'NONE' || isInAutoLayout"
          :model-value="widthSizing"
          :options="widthSizingOptions"
          @update:model-value="setWidthSizing"
        />
      </div>

      <div class="flex min-w-0 flex-1 items-center gap-1">
        <ScrubInput
          icon="H"
          :model-value="Math.round(node.height)"
          :min="0"
          @update:model-value="updateProp('height', $event)"
          @commit="(v: number, p: number) => commitProp('height', v, p)"
        />
        <AppSelect
          v-if="node.layoutMode !== 'NONE' || isInAutoLayout"
          :model-value="heightSizing"
          :options="heightSizingOptions"
          @update:model-value="setHeightSizing"
        />
      </div>
    </div>
  </div>

  <div v-if="node.type === 'FRAME'" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1.5 block text-[11px] text-muted">Auto layout</label>
      <button
        v-if="node.layoutMode === 'NONE'"
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        data-test-id="layout-add-auto"
        title="Add auto layout (Shift+A)"
        @click="store.setLayoutMode(node.id, 'VERTICAL')"
      >
        +
      </button>
      <button
        v-else
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        data-test-id="layout-remove-auto"
        title="Remove auto layout"
        @click="store.setLayoutMode(node.id, 'NONE')"
      >
        −
      </button>
    </div>

    <template v-if="node.layoutMode !== 'NONE'">
      <div class="mt-1.5 flex gap-0.5">
        <button
          data-test-id="layout-direction-horizontal"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutMode === 'HORIZONTAL'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Horizontal layout"
          @click="store.setLayoutMode(node.id, 'HORIZONTAL')"
        >
          <icon-lucide-arrow-right class="size-3.5" />
        </button>
        <button
          data-test-id="layout-direction-vertical"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutMode === 'VERTICAL'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Vertical layout"
          @click="store.setLayoutMode(node.id, 'VERTICAL')"
        >
          <icon-lucide-arrow-down class="size-3.5" />
        </button>
        <button
          data-test-id="layout-direction-wrap"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutWrap === 'WRAP'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Wrap"
          @click="updateProp('layoutWrap', node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
        >
          <icon-lucide-wrap-text class="size-3.5" />
        </button>
      </div>

      <div class="mt-2 grid grid-cols-2 gap-1.5">
        <ScrubInput
          data-test-id="layout-gap-input"
          icon="Gap"
          :model-value="Math.round(node.itemSpacing)"
          :min="0"
          @update:model-value="updateProp('itemSpacing', $event)"
          @commit="(v: number, p: number) => commitProp('itemSpacing', v, p)"
        />

        <template v-if="hasUniformPadding() && !showIndividualPadding">
          <ScrubInput
            data-test-id="layout-uniform-padding-input"
            icon="Pad"
            :model-value="Math.round(node.paddingTop)"
            :min="0"
            @update:model-value="setUniformPadding"
            @commit="commitUniformPadding"
          />
        </template>
        <button
          class="rounded border border-border bg-transparent px-2 py-1 text-left text-xs text-muted hover:bg-hover hover:text-surface"
          @click="showIndividualPadding = !showIndividualPadding"
        >
          {{ showIndividualPadding ? 'Uniform padding' : 'Per-side padding' }}
        </button>
      </div>

      <div
        v-if="showIndividualPadding || !hasUniformPadding()"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <ScrubInput
          icon="Top"
          :model-value="Math.round(node.paddingTop)"
          :min="0"
          @update:model-value="updateProp('paddingTop', $event)"
          @commit="(v: number, p: number) => commitProp('paddingTop', v, p)"
        />
        <ScrubInput
          icon="Right"
          :model-value="Math.round(node.paddingRight)"
          :min="0"
          @update:model-value="updateProp('paddingRight', $event)"
          @commit="(v: number, p: number) => commitProp('paddingRight', v, p)"
        />
        <ScrubInput
          icon="Bottom"
          :model-value="Math.round(node.paddingBottom)"
          :min="0"
          @update:model-value="updateProp('paddingBottom', $event)"
          @commit="(v: number, p: number) => commitProp('paddingBottom', v, p)"
        />
        <ScrubInput
          icon="Left"
          :model-value="Math.round(node.paddingLeft)"
          :min="0"
          @update:model-value="updateProp('paddingLeft', $event)"
          @commit="(v: number, p: number) => commitProp('paddingLeft', v, p)"
        />
      </div>

      <div class="mt-2">
        <label class="mb-1 block text-[11px] text-muted">Alignment</label>
        <div data-test-id="layout-alignment-grid" class="grid grid-cols-3 gap-1">
          <button
            v-for="cell in ALIGN_GRID"
            :key="`${cell.primary}-${cell.counter}`"
            class="flex aspect-square cursor-pointer items-center justify-center rounded border text-[11px]"
            :class="
              node.primaryAxisAlign === cell.primary && node.counterAxisAlign === cell.counter
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted hover:bg-hover hover:text-surface'
            "
            @click="setAlignment(cell.primary, cell.counter)"
          >
            <span class="size-1.5 rounded-full bg-current" />
          </button>
        </div>
      </div>
    </template>
  </div>

  <div v-if="node.type === 'FRAME'" class="border-b border-border px-3 py-2">
    <label class="flex cursor-pointer items-center gap-2 text-xs text-surface">
      <input
        type="checkbox"
        data-test-id="clip-content-checkbox"
        class="accent-accent"
        :checked="node.clipsContent"
        @change="
          store.updateNodeWithUndo(
            node.id,
            { clipsContent: !node.clipsContent },
            'Toggle clip content'
          )
        "
      />
      Clip content
    </label>
  </div>
</template>
