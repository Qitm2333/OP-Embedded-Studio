import type { EditorContext } from './types'

export function createTextActions(ctx: EditorContext) {
  let textBeforeEdit: string | null = null

  function startTextEditing(nodeId: string) {
    const te = ctx.getTextEditor()
    if (ctx.state.editingTextId) commitTextEdit()
    const node = ctx.graph.getNode(nodeId)
    if (!node) return
    textBeforeEdit = node.text
    ctx.state.editingTextId = nodeId
    if (te) {
      te.setRenderer(ctx.getRenderer())
      te.start(node)
    }
    ctx.requestRender()
  }

  function commitTextEdit() {
    const te = ctx.getTextEditor()
    if (!te?.isActive) {
      ctx.state.editingTextId = null
      textBeforeEdit = null
      return
    }
    const result = te.stop()
    if (!result) {
      ctx.state.editingTextId = null
      textBeforeEdit = null
      ctx.requestRender()
      return
    }
    const prevText = textBeforeEdit ?? ''
    const newText = result.text
    ctx.graph.updateNode(result.nodeId, { text: newText })
    ctx.state.editingTextId = null
    textBeforeEdit = null
    if (prevText !== newText) {
      ctx.undo.push({
        label: 'Edit text',
        forward: () => {
          ctx.graph.updateNode(result.nodeId, { text: newText })
        },
        inverse: () => {
          ctx.graph.updateNode(result.nodeId, { text: prevText })
        }
      })
    }
  }

  return { startTextEditing, commitTextEdit }
}
