export type { Editor, EditorState, EditorOptions, Tool, EditorToolDef } from '@open-pencil/core/editor'
export { createEditor, EDITOR_TOOLS, TOOL_SHORTCUTS } from '@open-pencil/core/editor'

export { EDITOR_KEY, provideEditor, useEditor } from './context'

export { useCanvas } from './composables/use-canvas'
export type { UseCanvasOptions } from './composables/use-canvas'

export { default as OpenPencilProvider } from './components/OpenPencilProvider.vue'
export { default as OpenPencilCanvas } from './components/OpenPencilCanvas.vue'
export { default as PageList } from './components/PageList.vue'
export { default as LayerTree } from './components/LayerTree.vue'
export { default as ToolSelector } from './components/ToolSelector.vue'
export { default as NodeProperties } from './components/NodeProperties.vue'
