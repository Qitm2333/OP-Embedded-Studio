<script setup lang="ts">
import { computed } from 'vue'

import type { SceneNode } from '@open-pencil/core/scene-graph'

import { useEditor } from '../context'

const editor = useEditor()

const node = computed(() => editor.getSelectedNode())

function update(props: Partial<SceneNode>) {
  const n = node.value
  if (!n) return
  editor.updateNodeWithUndo(n.id, props)
}
</script>

<template>
  <slot :node="node" :update="update" :editor="editor" />
</template>
