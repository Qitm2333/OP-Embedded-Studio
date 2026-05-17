import { describe, expect, test } from 'bun:test'

import { initCanvasKit } from '#cli/headless'
import { SkiaRenderer } from '#core/canvas'
import { createEditor } from '#core/editor'

async function createEditorWithRenderer() {
  const ck = await initCanvasKit()
  const surface = ck.MakeSurface(200, 200)
  if (!surface) throw new Error('Could not create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  const editor = createEditor()
  editor.setCanvasKit(ck, renderer)
  return { editor, surface }
}

describe('flattenSelected', () => {
  test('converts selected shapes into a vector path', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const first = editor.graph.createNode('RECTANGLE', pageId, { x: 10, y: 20, width: 50, height: 40 })
    const second = editor.graph.createNode('ELLIPSE', pageId, { x: 40, y: 30, width: 50, height: 40 })

    editor.select([first.id, second.id])
    editor.flattenSelected()

    const [vectorId] = [...editor.state.selectedIds]
    const vector = editor.graph.getNode(vectorId)
    expect(vector?.type).toBe('VECTOR')
    expect(vector?.x).toBe(10)
    expect(vector?.y).toBe(20)
    expect(vector?.width).toBe(80)
    expect(vector?.height).toBe(50)
    expect(vector?.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(editor.graph.getNode(first.id)).toBeUndefined()
    expect(editor.graph.getNode(second.id)).toBeUndefined()
    surface.delete()
  })

  test('undo and redo restore flattened children and vector', async () => {
    const { editor, surface } = await createEditorWithRenderer()
    const pageId = editor.state.currentPageId
    const before = editor.graph.createNode('RECTANGLE', pageId, { name: 'Before' })
    const first = editor.graph.createNode('RECTANGLE', pageId, { name: 'First' })
    const second = editor.graph.createNode('ELLIPSE', pageId, { name: 'Second', x: 50 })
    const after = editor.graph.createNode('RECTANGLE', pageId, { name: 'After' })

    editor.select([first.id, second.id])
    editor.flattenSelected()
    const [vectorId] = [...editor.state.selectedIds]
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, vectorId, after.id])

    editor.undo.undo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, first.id, second.id, after.id])
    expect(editor.state.selectedIds).toEqual(new Set([first.id, second.id]))

    editor.undo.redo()
    expect(editor.graph.getNode(pageId)?.childIds).toEqual([before.id, vectorId, after.id])
    expect(editor.graph.getNode(vectorId)?.type).toBe('VECTOR')
    surface.delete()
  })
})
