import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { MIXED, useNodeProps } from '@open-pencil/vue/controls/useNodeProps'

import type { SceneNode } from '@open-pencil/core'

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE'
])

/**
 * Returns appearance-related state and actions for the current selection.
 *
 * Use this composable for visibility, opacity, and corner-radius controls in
 * property panels.
 */
export function useAppearance() {
  const editor = useEditor()
  const { nodes, node, active, isMulti, merged, updateProp, commitProp } = useNodeProps()

  const hasCornerRadius = computed(() => {
    if (isMulti.value) return nodes.value.every((n) => CORNER_RADIUS_TYPES.has(n.type))
    return node.value ? CORNER_RADIUS_TYPES.has(node.value.type) : false
  })

  const independentCorners = computed(() => {
    if (isMulti.value) return merged('independentCorners')
    return node.value?.independentCorners ?? false
  })

  const cornerRadiusValue = computed(() => {
    if (isMulti.value) return merged('cornerRadius')
    return node.value?.cornerRadius ?? 0
  })

  const opacityPercent = computed(() => {
    const v = merged('opacity')
    return v === MIXED ? MIXED : Math.round((v as number) * 100)
  })

  const visibilityState = computed<'visible' | 'hidden' | 'mixed'>(() => {
    const v = merged('visible')
    if (v === MIXED) return 'mixed'
    return v ? 'visible' : 'hidden'
  })

  function toggleVisibility() {
    if (isMulti.value) {
      const liveNodes = nodes.value
        .map((n) => editor.getNode(n.id))
        .filter((n): n is SceneNode => n != null)
      if (liveNodes.length === 0) return
      const allVisible = liveNodes.every((n) => n.visible)
      editor.undo.beginBatch('Toggle visibility')
      for (const n of liveNodes) {
        editor.updateNodeWithUndo(n.id, { visible: !allVisible }, 'Toggle visibility')
      }
      editor.undo.commitBatch()
      return
    }

    const selected = node.value
    if (!selected) return
    const liveNode = editor.getNode(selected.id)
    if (!liveNode) return
    editor.updateNodeWithUndo(liveNode.id, { visible: !liveNode.visible }, 'Toggle visibility')
  }

  function toggleIndependentCorners() {
    const targets = isMulti.value ? nodes.value : node.value ? [node.value] : []
    for (const n of targets) {
      if (n.independentCorners) {
        const uniform = n.topLeftRadius
        editor.updateNodeWithUndo(
          n.id,
          {
            independentCorners: false,
            cornerRadius: uniform,
            topLeftRadius: uniform,
            topRightRadius: uniform,
            bottomRightRadius: uniform,
            bottomLeftRadius: uniform
          } as Partial<SceneNode>,
          'Uniform corner radius'
        )
      } else {
        editor.updateNodeWithUndo(
          n.id,
          {
            independentCorners: true,
            topLeftRadius: n.cornerRadius,
            topRightRadius: n.cornerRadius,
            bottomRightRadius: n.cornerRadius,
            bottomLeftRadius: n.cornerRadius
          } as Partial<SceneNode>,
          'Independent corner radii'
        )
      }
    }
  }

  function updateCornerProp(key: string, value: number) {
    if (isMulti.value) {
      for (const n of nodes.value) editor.updateNode(n.id, { [key]: value })
    } else {
      const n = node.value
      if (n) editor.updateNode(n.id, { [key]: value })
    }
  }

  function commitCornerProp(key: string, _value: number, previous: number) {
    if (isMulti.value) {
      for (const n of nodes.value) {
        editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
      }
    } else {
      const n = node.value
      if (n)
        editor.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
    }
  }

  return {
    editor,
    nodes,
    node,
    active,
    isMulti,
    hasCornerRadius,
    independentCorners,
    cornerRadiusValue,
    opacityPercent,
    visibilityState,
    updateProp,
    commitProp,
    toggleVisibility,
    toggleIndependentCorners,
    updateCornerProp,
    commitCornerProp
  }
}
