import { describe, expect, test } from 'bun:test'

import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'

describe('paste to replace', () => {
  test('replaces selected nodes with pasted OpenPencil nodes', async () => {
    const source = createEditor()
    const sourcePageId = source.state.currentPageId
    const pasted = source.graph.createNode('RECTANGLE', sourcePageId, {
      name: 'Pasted',
      x: 0,
      y: 0,
      width: 20,
      height: 20
    })
    const html = buildOpenPencilClipboardHTML([pasted], source.graph)

    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const target = editor.graph.createNode('ELLIPSE', pageId, {
      name: 'Target',
      x: 100,
      y: 100,
      width: 40,
      height: 40
    })

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })

    expect(editor.graph.getNode(target.id)).toBeUndefined()
    const [createdId] = [...editor.state.selectedIds]
    const created = editor.graph.getNode(createdId)
    expect(created?.name).toBe('Pasted')
    expect(created?.parentId).toBe(pageId)
    expect(created?.x).toBe(110)
    expect(created?.y).toBe(110)
  })

  test('undo and redo preserve replaced and pasted subtrees', async () => {
    const source = createEditor()
    const sourcePageId = source.state.currentPageId
    const pasted = source.graph.createNode('RECTANGLE', sourcePageId, {
      name: 'Pasted',
      x: 0,
      y: 0,
      width: 20,
      height: 20
    })
    const html = buildOpenPencilClipboardHTML([pasted], source.graph)

    const editor = createEditor()
    const pageId = editor.state.currentPageId
    const target = editor.graph.createNode('ELLIPSE', pageId, {
      name: 'Target',
      x: 100,
      y: 100,
      width: 40,
      height: 40
    })

    editor.select([target.id])
    await editor.pasteFromHTML(html, undefined, { replaceSelection: true })
    const [createdId] = [...editor.state.selectedIds]

    editor.undo.undo()

    expect(editor.graph.getNode(createdId)).toBeUndefined()
    expect(editor.graph.getNode(target.id)?.parentId).toBe(pageId)
    expect(editor.state.selectedIds).toEqual(new Set([target.id]))

    editor.undo.redo()

    expect(editor.graph.getNode(target.id)).toBeUndefined()
    expect(editor.graph.getNode(createdId)?.parentId).toBe(pageId)
    expect(editor.state.selectedIds).toEqual(new Set([createdId]))
  })
})
