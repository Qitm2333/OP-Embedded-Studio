import {
  clearNodeFillOkHCL,
  clearNodeStrokeOkHCL,
  getFillOkHCL,
  getStrokeOkHCL,
  rgbaToOkHCL,
  setNodeFillOkHCL,
  setNodeStrokeOkHCL
} from '@open-pencil/core'
import { useEditor } from '@open-pencil/vue/context/editorContext'

import type { OkHCLColor, SceneNode } from '@open-pencil/core'

export type ColorModel = 'rgba' | 'okhcl'

export function useOkHCL() {
  const editor = useEditor()

  function getFillColorModel(node: SceneNode | null, index: number): ColorModel {
    if (!node) return 'rgba'
    return getFillOkHCL(node, index) ? 'okhcl' : 'rgba'
  }

  function getStrokeColorModel(node: SceneNode | null, index: number): ColorModel {
    if (!node) return 'rgba'
    return getStrokeOkHCL(node, index) ? 'okhcl' : 'rgba'
  }

  function getFillOkHCLColor(node: SceneNode | null, index: number): OkHCLColor | null {
    return node ? getFillOkHCL(node, index)?.color ?? null : null
  }

  function getStrokeOkHCLColor(node: SceneNode | null, index: number): OkHCLColor | null {
    return node ? getStrokeOkHCL(node, index)?.color ?? null : null
  }

  function enableFillOkHCL(node: SceneNode, index: number) {
    const color = getFillOkHCLColor(node, index) ?? rgbaToOkHCL(node.fills[index]?.color ?? { r: 0, g: 0, b: 0, a: 1 })
    editor.updateNodeWithUndo(node.id, setNodeFillOkHCL(node, index, color), 'Enable fill OkHCL')
  }

  function disableFillOkHCL(node: SceneNode, index: number) {
    editor.updateNodeWithUndo(node.id, clearNodeFillOkHCL(node, index), 'Disable fill OkHCL')
  }

  function enableStrokeOkHCL(node: SceneNode, index: number) {
    const color = getStrokeOkHCLColor(node, index) ?? rgbaToOkHCL(node.strokes[index]?.color ?? { r: 0, g: 0, b: 0, a: 1 })
    editor.updateNodeWithUndo(node.id, setNodeStrokeOkHCL(node, index, color), 'Enable stroke OkHCL')
  }

  function disableStrokeOkHCL(node: SceneNode, index: number) {
    editor.updateNodeWithUndo(node.id, clearNodeStrokeOkHCL(node, index), 'Disable stroke OkHCL')
  }

  function updateFillOkHCL(node: SceneNode, index: number, patch: Partial<OkHCLColor>) {
    const current = getFillOkHCLColor(node, index) ?? { h: 0, c: 0.1, l: 0.5, a: 1 }
    editor.updateNodeWithUndo(
      node.id,
      setNodeFillOkHCL(node, index, { ...current, ...patch }),
      'Change fill OkHCL'
    )
  }

  function updateStrokeOkHCL(node: SceneNode, index: number, patch: Partial<OkHCLColor>) {
    const current = getStrokeOkHCLColor(node, index) ?? { h: 0, c: 0.1, l: 0.5, a: 1 }
    editor.updateNodeWithUndo(
      node.id,
      setNodeStrokeOkHCL(node, index, { ...current, ...patch }),
      'Change stroke OkHCL'
    )
  }

  return {
    getFillColorModel,
    getStrokeColorModel,
    getFillOkHCLColor,
    getStrokeOkHCLColor,
    enableFillOkHCL,
    disableFillOkHCL,
    enableStrokeOkHCL,
    disableStrokeOkHCL,
    updateFillOkHCL,
    updateStrokeOkHCL,
    modelOptions: [
      { value: 'rgba' as const, label: 'RGBA' },
      { value: 'okhcl' as const, label: 'OkHCL' }
    ]
  }
}
