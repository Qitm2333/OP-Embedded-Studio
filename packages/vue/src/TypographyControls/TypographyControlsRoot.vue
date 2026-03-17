<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { FONT_WEIGHT_NAMES, weightToStyle } from '@open-pencil/core'

import type { SceneNode, TextDecoration } from '@open-pencil/core'

import { useEditor } from '../context'
import { useNodeFontStatus } from '../composables/use-font-status'

type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT'

const WEIGHTS = Object.entries(FONT_WEIGHT_NAMES).map(([value, label]) => ({
  value: Number(value),
  label
}))

const props = defineProps<{
  loadFont?: (family: string, style: string) => Promise<unknown>
}>()

const editor = useEditor()

const node = computed<SceneNode | null>(() => editor.getSelectedNode() ?? null)

const { missingFonts, hasMissingFonts } = useNodeFontStatus(() => node.value)

const currentWeightLabel = computed(() =>
  FONT_WEIGHT_NAMES[node.value?.fontWeight ?? 400] ?? 'Regular'
)

const activeFormatting = computed(() => {
  const n = node.value
  if (!n) return []
  const result: string[] = []
  if (n.fontWeight >= 700) result.push('bold')
  if (n.italic) result.push('italic')
  if (n.textDecoration === 'UNDERLINE') result.push('underline')
  if (n.textDecoration === 'STRIKETHROUGH') result.push('strikethrough')
  return result
})

async function doLoadFont(family: string, style: string) {
  if (props.loadFont) await props.loadFont(family, style)
}

async function setFamily(family: string) {
  if (!node.value) return
  await doLoadFont(family, currentWeightLabel.value)
  editor.updateNodeWithUndo(node.value.id, { fontFamily: family }, 'Change font')
}

async function setWeight(weight: number) {
  if (!node.value) return
  const style = weightToStyle(weight)
  await doLoadFont(node.value.fontFamily, style)
  editor.updateNodeWithUndo(node.value.id, { fontWeight: weight }, 'Change font weight')
}

function setAlign(align: TextAlign) {
  if (!node.value) return
  editor.updateNodeWithUndo(node.value.id, { textAlignHorizontal: align }, 'Change text alignment')
}

function toggleBold() {
  if (!node.value) return
  setWeight(node.value.fontWeight >= 700 ? 400 : 700)
}

function toggleItalic() {
  if (!node.value) return
  editor.updateNodeWithUndo(node.value.id, { italic: !node.value.italic }, 'Toggle italic')
}

function toggleDecoration(deco: 'UNDERLINE' | 'STRIKETHROUGH') {
  if (!node.value) return
  const current = node.value.textDecoration
  editor.updateNodeWithUndo(
    node.value.id,
    { textDecoration: (current === deco ? 'NONE' : deco) as TextDecoration },
    `Toggle ${deco.toLowerCase()}`
  )
}

function onFormattingChange(values: string[]) {
  if (!node.value) return
  const prev = activeFormatting.value
  const added = values.filter((v) => !prev.includes(v))
  const removed = prev.filter((v) => !values.includes(v))
  for (const item of [...added, ...removed]) {
    if (item === 'bold') toggleBold()
    else if (item === 'italic') toggleItalic()
    else if (item === 'underline') toggleDecoration('UNDERLINE')
    else if (item === 'strikethrough') toggleDecoration('STRIKETHROUGH')
  }
}

function updateProp(key: string, value: number | string) {
  if (node.value) editor.updateNode(node.value.id, { [key]: value })
}

function commitProp(key: string, _value: number | string, previous: number | string) {
  if (node.value) {
    editor.commitNodeUpdate(node.value.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
  }
}

onMounted(async () => {
  if (!node.value) return
  await doLoadFont(node.value.fontFamily, currentWeightLabel.value)
})
</script>

<template>
  <slot
    v-if="node"
    :node="node"
    :weights="WEIGHTS"
    :current-weight-label="currentWeightLabel"
    :active-formatting="activeFormatting"
    :missing-fonts="missingFonts"
    :has-missing-fonts="hasMissingFonts"
    :set-family="setFamily"
    :set-weight="setWeight"
    :set-align="setAlign"
    :toggle-bold="toggleBold"
    :toggle-italic="toggleItalic"
    :toggle-decoration="toggleDecoration"
    :on-formatting-change="onFormattingChange"
    :update-prop="updateProp"
    :commit-prop="commitProp"
  />
</template>
