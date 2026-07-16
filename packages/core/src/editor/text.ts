import { computeAllLayouts } from '#core/layout'
import { ensureTextFallbackPacksForNodes } from '#core/text/coverage'
import { fontManager } from '#core/text/fonts'

import {
  createTextEditSession,
  resizeTextNodeForEdit,
  snapshotTextNode,
  textSnapshotChanged,
  type TextEditSession
} from './text/session'
import type { EditorContext } from './types'

export function createTextActions(ctx: EditorContext) {
  let activeSession: TextEditSession | null = null

  function requestTextFallbackFonts(nodeId: string): void {
    void ensureTextFallbackPacksForNodes(ctx.graph, [nodeId])
      .then((loaded) => {
        if (loaded) {
          ctx.getRenderer()?.invalidateAllPictures()
          computeAllLayouts(ctx.graph, ctx.state.currentPageId)
          ctx.requestRender()
        }
        return undefined
      })
      .catch((err) => {
        console.error(
          `Failed to load fallback fonts: ${err instanceof Error ? err.message : String(err)}`
        )
      })
  }

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    activeSession = createTextEditSession(node)
    ctx.state.editingTextId = nodeId
    if (te) {
      te.setRenderer(ctx.getRenderer())
      te.start(node)
    }
    ctx.requestRender()

    // Derived Figma outlines look correct without CanvasKit faces. Live edit drops those
    // outlines and paints via Paragraph — ensure faces are on the active provider first.
    void fontManager.ensureTextNodeFonts(node, ctx.getRenderer()).then(() => {
      if (ctx.state.editingTextId !== nodeId) return
      const latest = ctx.graph.getNode(nodeId)
      const editor = ctx.getTextEditor()
      if (!latest || !editor?.isActive || editor.nodeId !== nodeId) return
      editor.setRenderer(ctx.getRenderer())
      editor.rebuildParagraph(latest)
      ctx.requestRender()
    })
  }

  function commitTextEdit() {
    const te = ctx.getTextEditor()
    if (!te?.isActive) {
      ctx.state.editingTextId = null
      activeSession = null
      return
    }
    const textState = te.state
    if (!textState) {
      te.stop()
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }
    const result = { nodeId: textState.nodeId, text: textState.text }
    const before = activeSession?.before ?? { text: '', styleRuns: [], size: {} }
    const node = ctx.graph.getNode(result.nodeId)
    const after = snapshotTextNode(node, result.text)
    after.text = result.text
    const sizeChanges =
      before.text !== after.text ? resizeTextNodeForEdit(node, textState.paragraph) : {}
    if (Object.keys(sizeChanges).length > 0) after.size = sizeChanges
    const changed = textSnapshotChanged(before, after)

    te.stop()

    if (!changed) {
      ctx.state.editingTextId = null
      activeSession = null
      ctx.requestRender()
      return
    }

    ctx.graph.updateNode(result.nodeId, {
      text: after.text,
      styleRuns: after.styleRuns,
      ...sizeChanges
    })
    requestTextFallbackFonts(result.nodeId)
    ctx.state.editingTextId = null
    activeSession = null

    ctx.undo.push({
      label: 'Edit text',
      forward: () => {
        ctx.graph.updateNode(result.nodeId, {
          text: after.text,
          styleRuns: after.styleRuns,
          ...after.size
        })
        requestTextFallbackFonts(result.nodeId)
      },
      inverse: () => {
        ctx.graph.updateNode(result.nodeId, {
          text: before.text,
          styleRuns: before.styleRuns,
          ...before.size
        })
        requestTextFallbackFonts(result.nodeId)
      }
    })
  }

  return { startTextEditing, commitTextEdit }
}
