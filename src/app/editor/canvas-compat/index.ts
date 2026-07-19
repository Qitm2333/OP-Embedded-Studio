import type { Editor } from '@open-pencil/core/editor'
import type { SceneGraph } from '@open-pencil/scene-graph'

import { installClipboardCompatibility } from './clipboard'
import { installReparentCompatibility } from './reparent'

const INSTALLED = Symbol('open-pencil-canvas-compat')

type CompatibilityEditor = Editor & { [INSTALLED]?: boolean }

export function installCanvasCompatibility(editor: Editor): void {
  const patched = editor as CompatibilityEditor
  if (patched[INSTALLED]) return
  patched[INSTALLED] = true

  installClipboardCompatibility(editor)
  installReparentCompatibility(editor.graph)

  const originalReplaceGraph = editor.replaceGraph.bind(editor)
  editor.replaceGraph = (graph: SceneGraph) => {
    originalReplaceGraph(graph)
    installReparentCompatibility(editor.graph)
  }
}

export { useImageCropCompatibility } from './use-image-crop'
