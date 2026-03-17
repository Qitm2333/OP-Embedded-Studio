<script setup lang="ts">
import { computed } from 'vue'

import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@open-pencil/vue'

const {
  store,
  updateProp,
  commitProp,
  node,
  nodes,
  isMulti,
  active,
  prop: multiProp
} = useNodeProps()

const xValue = computed(() =>
  isMulti.value ? multiProp('x').value : Math.round(node.value?.x ?? 0)
)
const yValue = computed(() =>
  isMulti.value ? multiProp('y').value : Math.round(node.value?.y ?? 0)
)
const wValue = multiProp('width')
const hValue = multiProp('height')
const rotationValue = computed(() =>
  isMulti.value ? multiProp('rotation').value : Math.round(node.value?.rotation ?? 0)
)
const ids = computed(() => nodes.value.map((n) => n.id))
</script>

<template>
  <div v-if="active" data-test-id="position-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Position</label>

    <!-- Alignment buttons -->
    <div class="mb-1.5 flex gap-2">
      <div class="flex gap-0.5">
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-left"
          title="Align left"
          @click="store.alignNodes(ids, 'horizontal', 'min')"
        >
          <icon-lucide-align-horizontal-justify-start class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-center-h"
          title="Align center horizontally"
          @click="store.alignNodes(ids, 'horizontal', 'center')"
        >
          <icon-lucide-align-horizontal-justify-center class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-right"
          title="Align right"
          @click="store.alignNodes(ids, 'horizontal', 'max')"
        >
          <icon-lucide-align-horizontal-justify-end class="size-3.5" />
        </button>
      </div>
      <div class="flex gap-0.5">
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-top"
          title="Align top"
          @click="store.alignNodes(ids, 'vertical', 'min')"
        >
          <icon-lucide-align-vertical-justify-start class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-center-v"
          title="Align center vertically"
          @click="store.alignNodes(ids, 'vertical', 'center')"
        >
          <icon-lucide-align-vertical-justify-center class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-bottom"
          title="Align bottom"
          @click="store.alignNodes(ids, 'vertical', 'max')"
        >
          <icon-lucide-align-vertical-justify-end class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- X / Y -->
    <div class="flex gap-1.5">
      <ScrubInput
        icon="X"
        :model-value="xValue"
        @update:model-value="updateProp('x', $event)"
        @commit="(v: number, p: number) => commitProp('x', v, p)"
      />
      <ScrubInput
        icon="Y"
        :model-value="yValue"
        @update:model-value="updateProp('y', $event)"
        @commit="(v: number, p: number) => commitProp('y', v, p)"
      />
    </div>

    <!-- W / H (multi-select only; single-select shows in LayoutSection) -->
    <div v-if="isMulti" class="mt-1.5 flex gap-1.5">
      <ScrubInput
        icon="W"
        :model-value="wValue"
        :min="1"
        @update:model-value="updateProp('width', $event)"
        @commit="(v: number, p: number) => commitProp('width', v, p)"
      />
      <ScrubInput
        icon="H"
        :model-value="hValue"
        :min="1"
        @update:model-value="updateProp('height', $event)"
        @commit="(v: number, p: number) => commitProp('height', v, p)"
      />
    </div>

    <!-- Rotation + flip -->
    <div class="mt-1.5 flex items-center gap-1.5">
      <ScrubInput
        class="flex-1"
        suffix="°"
        :model-value="rotationValue"
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
        data-test-id="position-flip-horizontal"
        title="Flip horizontal"
        @click="store.flipNodes(ids, 'horizontal')"
      >
        <icon-lucide-flip-horizontal class="size-3.5" />
      </button>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        data-test-id="position-flip-vertical"
        title="Flip vertical"
        @click="store.flipNodes(ids, 'vertical')"
      >
        <icon-lucide-flip-vertical class="size-3.5" />
      </button>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        data-test-id="position-rotate-90"
        title="Rotate 90°"
        @click="store.rotateNodes(ids, 90)"
      >
        <icon-lucide-rotate-cw class="size-3.5" />
      </button>
    </div>
  </div>
</template>
