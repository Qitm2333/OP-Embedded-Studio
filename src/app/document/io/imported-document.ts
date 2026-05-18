import type { Editor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph, SceneNode } from '@open-pencil/core/scene-graph'

export async function applyImportedDocument(editor: Editor, imported: SceneGraph) {
  computeAllLayouts(imported)
  editor.replaceGraph(imported)
  editor.undo.clear()
  editor.clearSelection()
  const firstPage = editor.graph.getPages()[0] as SceneNode | undefined
  const pageId = firstPage?.id ?? editor.graph.rootId
  await editor.switchPage(pageId)
}
