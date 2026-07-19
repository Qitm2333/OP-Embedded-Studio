import {
  attachInstruction,
  extractInstruction,
  type ItemMode
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  draggable,
  dropTargetForElements,
  monitorForElements
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { onScopeDispose, ref, watchEffect, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import type { LayerDragInstruction } from '#vue/primitives/LayerTree/context'
import { layerDropInsertIndex } from '#vue/primitives/LayerTree/order'
import type { LayerTreeDisplayOrder } from '#vue/primitives/LayerTree/order'

interface DragItem {
  id: string
  level: number
  hasChildren: boolean
  parentId: string | null
}

type TreeInstruction = LayerDragInstruction

export function useLayerDrag(
  editor: Editor,
  indentPerLevel = 16,
  onMakeChildDrop?: (targetId: string) => void,
  getDisplayOrder: () => LayerTreeDisplayOrder = () => 'document'
) {
  const draggingId = ref<string | null>(null)
  const instruction = ref<TreeInstruction | null>(null)
  const instructionTargetId = ref<string | null>(null)

  function setupItem(el: Ref<HTMLElement | null>, item: () => DragItem) {
    watchEffect((onCleanup) => {
      const element = el.value
      if (!element) return

      const data = item()

      const isContainer = editor.graph.isContainer(data.id)
      const mode: ItemMode = data.hasChildren ? 'expanded' : 'standard'

      const cleanup = combine(
        draggable({
          element,
          getInitialData: () => ({ id: data.id }),
          onDragStart: () => {
            draggingId.value = data.id
          },
          onDrop: () => {
            draggingId.value = null
          }
        }),
        dropTargetForElements({
          element,
          getData: ({ input, element: el }) =>
            attachInstruction(
              { id: data.id },
              {
                input,
                element: el,
                indentPerLevel,
                currentLevel: data.level,
                mode,
                block: isContainer ? ['reparent'] : ['make-child', 'reparent']
              }
            ),
          canDrop: ({ source }) => source.data.id !== data.id,
          onDrag: ({ self }) => {
            const inst = extractInstruction(self.data)
            if (!inst || inst.type === 'instruction-blocked') {
              instruction.value = null
              instructionTargetId.value = null
              return
            }
            instruction.value = inst as TreeInstruction
            instructionTargetId.value = data.id
          },
          onDragLeave: () => {
            instruction.value = null
            instructionTargetId.value = null
          },
          onDrop: () => {
            instruction.value = null
            instructionTargetId.value = null
          },
          getIsSticky: () => true
        })
      )

      onCleanup(cleanup)
    })
  }

  const cleanupMonitor = monitorForElements({
    onDrop: ({ source, location }) => {
      const target = location.current.dropTargets.at(0)
      if (!target) return

      const sourceId = source.data.id as string
      const targetId = target.data.id as string
      const rawInstruction = extractInstruction(target.data)
      if (!rawInstruction || rawInstruction.type === 'instruction-blocked') return
      const inst = rawInstruction as TreeInstruction
      if (!sourceId || !targetId) return

      if (editor.graph.isDescendant(targetId, sourceId)) return

      const targetNode = editor.graph.getNode(targetId)
      if (!targetNode) return
      const targetParentId = targetNode.parentId ?? editor.state.currentPageId
      const targetParent = editor.graph.getNode(targetParentId)
      if (!targetParent) return
      if (inst.type === 'reorder-above') {
        const insertIndex = layerDropInsertIndex(
          targetParent.childIds,
          sourceId,
          targetId,
          'above',
          getDisplayOrder()
        )
        if (insertIndex === null) return
        editor.reorderChildWithUndo(sourceId, targetParentId, insertIndex)
      } else if (inst.type === 'reorder-below') {
        const insertIndex = layerDropInsertIndex(
          targetParent.childIds,
          sourceId,
          targetId,
          'below',
          getDisplayOrder()
        )
        if (insertIndex === null) return
        editor.reorderChildWithUndo(sourceId, targetParentId, insertIndex)
      } else {
        const container = editor.graph.getNode(targetId)
        if (!container || !editor.graph.isContainer(targetId)) return
        editor.reorderChildWithUndo(sourceId, targetId, container.childIds.length)
        onMakeChildDrop?.(targetId)
      }

      draggingId.value = null
      instruction.value = null
      instructionTargetId.value = null
    }
  })
  onScopeDispose(cleanupMonitor)

  return {
    draggingId,
    instruction,
    instructionTargetId,
    setupItem
  }
}
