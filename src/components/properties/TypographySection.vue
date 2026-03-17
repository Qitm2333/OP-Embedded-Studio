<script setup lang="ts">
import { computed, onMounted } from 'vue'

import AppSelect from '@/components/AppSelect.vue'
import FontPicker from '@/components/FontPicker.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeFontStatus, useNodeProps } from '@open-pencil/vue'
import { loadFont } from '@/engine/fonts'
import { ToggleGroupItem, ToggleGroupRoot, type AcceptableValue } from 'reka-ui'
import Tip from '@/components/Tip.vue'

const { store, node, updateProp, commitProp } = useNodeProps()
const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)

const WEIGHTS = [
  { value: 100, label: 'Thin' },
  { value: 200, label: 'ExtraLight' },
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'SemiBold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'ExtraBold' },
  { value: 900, label: 'Black' }
]

const currentWeightLabel = computed(
  () => WEIGHTS.find((w) => w.value === node.value?.fontWeight)?.label ?? 'Regular'
)

type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT'

async function selectFamily(family: string) {
  if (!node.value) return
  await loadFont(family, currentWeightLabel.value)
  store.updateNodeWithUndo(node.value.id, { fontFamily: family }, 'Change font')
}

async function selectWeight(weight: number) {
  if (!node.value) return
  const label = WEIGHTS.find((w) => w.value === weight)?.label ?? 'Regular'
  await loadFont(node.value.fontFamily, label)
  store.updateNodeWithUndo(node.value.id, { fontWeight: weight }, 'Change font weight')
}

function setAlign(align: TextAlign) {
  if (!node.value) return
  store.updateNodeWithUndo(node.value.id, { textAlignHorizontal: align }, 'Change text alignment')
}

function toggleBold() {
  if (!node.value) return
  selectWeight(node.value.fontWeight >= 700 ? 400 : 700)
}

function toggleItalic() {
  if (!node.value) return
  store.updateNodeWithUndo(node.value.id, { italic: !node.value.italic }, 'Toggle italic')
}

function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
  if (!node.value) return
  const current = node.value.textDecoration
  store.updateNodeWithUndo(
    node.value.id,
    { textDecoration: current === deco ? 'NONE' : deco },
    `Toggle ${deco.toLowerCase()}`
  )
}

const activeFormatting = computed(() => {
  if (!node.value) return []
  const result: string[] = []
  if (node.value.fontWeight >= 700) result.push('bold')
  if (node.value.italic) result.push('italic')
  if (node.value.textDecoration === 'UNDERLINE') result.push('underline')
  if (node.value.textDecoration === 'STRIKETHROUGH') result.push('strikethrough')
  return result
})

function onFormattingChange(next: AcceptableValue | AcceptableValue[]) {
  if (!node.value || !Array.isArray(next)) return
  const prev = activeFormatting.value
  const values = next as string[]
  const added = values.filter((v) => !prev.includes(v))
  const removed = prev.filter((v) => !values.includes(v))
  for (const item of added) {
    if (item === 'bold') toggleBold()
    else if (item === 'italic') toggleItalic()
    else if (item === 'underline') toggleDecoration('UNDERLINE')
    else if (item === 'strikethrough') toggleDecoration('STRIKETHROUGH')
  }
  for (const item of removed) {
    if (item === 'bold') toggleBold()
    else if (item === 'italic') toggleItalic()
    else if (item === 'underline') toggleDecoration('UNDERLINE')
    else if (item === 'strikethrough') toggleDecoration('STRIKETHROUGH')
  }
}

onMounted(async () => {
  if (!node.value) return
  await loadFont(node.value.fontFamily, currentWeightLabel.value)
})
</script>

<template>
  <div v-if="node" data-test-id="typography-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Typography</label>

    <div class="mb-1.5 flex items-center gap-1.5">
      <FontPicker class="min-w-0 flex-1" :model-value="node.fontFamily" @select="selectFamily" />
      <Tip
        v-if="hasMissingFonts"
        :label="
          'Missing font' + (missingFonts.length > 1 ? 's' : '') + ': ' + missingFonts.join(', ')
        "
      >
        <icon-lucide-alert-triangle
          data-test-id="typography-missing-font"
          class="size-3.5 shrink-0 text-amber-400"
        />
      </Tip>
    </div>

    <!-- Weight + Size -->
    <div class="mb-1.5 flex gap-1.5">
      <AppSelect
        :model-value="node.fontWeight"
        :options="WEIGHTS"
        @update:model-value="selectWeight(+$event)"
      />
      <ScrubInput
        class="flex-1"
        :model-value="node.fontSize"
        :min="1"
        :max="1000"
        @update:model-value="updateProp('fontSize', $event)"
        @commit="(v: number, p: number) => commitProp('fontSize', v, p)"
      />
    </div>

    <!-- Line height + Letter spacing -->
    <div class="mb-1.5 flex gap-1.5">
      <ScrubInput
        class="flex-1"
        :model-value="node.lineHeight ?? Math.round((node.fontSize || 14) * 1.2)"
        :min="0"
        @update:model-value="updateProp('lineHeight', $event)"
        @commit="(v: number, p: number) => commitProp('lineHeight', v, p)"
      >
        <template #icon>
          <icon-lucide-baseline class="size-3" />
        </template>
      </ScrubInput>
      <ScrubInput
        class="flex-1"
        suffix="%"
        :model-value="node.letterSpacing"
        @update:model-value="updateProp('letterSpacing', $event)"
        @commit="(v: number, p: number) => commitProp('letterSpacing', v, p)"
      >
        <template #icon>
          <icon-lucide-a-large-small class="size-3" />
        </template>
      </ScrubInput>
    </div>

    <!-- Text alignment + formatting -->
    <div class="flex items-center gap-3">
      <ToggleGroupRoot
        type="single"
        class="flex gap-0.5"
        :model-value="node.textAlignHorizontal"
        @update:model-value="
          (val: AcceptableValue) => {
            if (val) setAlign(val as TextAlign)
          }
        "
      >
        <ToggleGroupItem
          v-for="align in ['LEFT', 'CENTER', 'RIGHT'] as TextAlign[]"
          :key="align"
          :value="align"
          class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
        >
          <icon-lucide-align-left v-if="align === 'LEFT'" class="size-3.5" />
          <icon-lucide-align-center v-else-if="align === 'CENTER'" class="size-3.5" />
          <icon-lucide-align-right v-else class="size-3.5" />
        </ToggleGroupItem>
      </ToggleGroupRoot>
      <ToggleGroupRoot
        type="multiple"
        class="flex gap-0.5"
        :model-value="activeFormatting"
        @update:model-value="onFormattingChange"
      >
        <Tip label="Bold (⌘B)">
          <ToggleGroupItem
            value="bold"
            data-test-id="typography-bold-button"
            class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 font-bold text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
          >
            <icon-lucide-bold class="size-3.5" />
          </ToggleGroupItem>
        </Tip>
        <Tip label="Italic (⌘I)">
          <ToggleGroupItem
            value="italic"
            class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
          >
            <icon-lucide-italic class="size-3.5" />
          </ToggleGroupItem>
        </Tip>
        <Tip label="Underline (⌘U)">
          <ToggleGroupItem
            value="underline"
            class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
          >
            <icon-lucide-underline class="size-3.5" />
          </ToggleGroupItem>
        </Tip>
        <Tip label="Strikethrough">
          <ToggleGroupItem
            value="strikethrough"
            class="flex cursor-pointer items-center justify-center rounded border border-border bg-input px-2 py-1 text-muted hover:bg-hover hover:text-surface data-[state=on]:border-accent data-[state=on]:bg-accent data-[state=on]:text-white"
          >
            <icon-lucide-strikethrough class="size-3.5" />
          </ToggleGroupItem>
        </Tip>
      </ToggleGroupRoot>
    </div>
  </div>
</template>
