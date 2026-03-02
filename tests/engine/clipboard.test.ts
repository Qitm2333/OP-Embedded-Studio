import { describe, expect, it } from 'bun:test'

import {
  parseFigmaClipboard,
  importClipboardNodes,
  figmaNodesBounds,
} from '../../packages/core/src/clipboard'
import { SceneGraph } from '../../packages/core/src/scene-graph'

function makeClipboardHtml(nodeChanges: unknown[], meta = { fileKey: 'test', pasteID: 1, dataType: 'scene' }) {
  // Minimal fig-kiwi clipboard: just meta + empty figma buffer
  // For real parsing we'd need actual Kiwi binary — these tests use importClipboardNodes directly
  const metaB64 = btoa(JSON.stringify(meta))
  return `<meta charset='utf-8'><span data-metadata="<!--(figmeta)${metaB64}(/figmeta)-->"></span><span data-buffer="<!--(figma)(/figma)-->"></span>`
}

function createGraphWithPage(): { graph: SceneGraph; pageId: string } {
  const graph = new SceneGraph()
  graph.addPage('Test')
  return { graph, pageId: graph.rootId }
}

describe('importClipboardNodes', () => {
  it('skips VARIABLE_SET and VARIABLE nodes', () => {
    const { graph, pageId } = createGraphWithPage()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Document' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page 1' },
      { guid: { sessionID: 0, localID: 2 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' }, type: 'VARIABLE_SET', name: 'Primitives' },
      { guid: { sessionID: 0, localID: 3 }, parentIndex: { guid: { sessionID: 0, localID: 2 }, position: '!' }, type: 'VARIABLE', name: 'Colors/Brand/500' },
      { guid: { sessionID: 0, localID: 10 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' }, type: 'FRAME', name: 'Card', size: { x: 300, y: 200 }, transform: { m00: 1, m01: 0, m02: 50, m10: 0, m11: 1, m12: 50 } },
      { guid: { sessionID: 0, localID: 11 }, parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' }, type: 'TEXT', name: 'Title', size: { x: 200, y: 30 }, transform: { m00: 1, m01: 0, m02: 10, m10: 0, m11: 1, m12: 10 }, textData: { characters: 'Hello' }, fontSize: 16 },
    ] as any[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const card = graph.getNode(created[0])!
    expect(card.type).toBe('FRAME')
    expect(card.name).toBe('Card')

    const children = graph.getChildren(card.id)
    expect(children).toHaveLength(1)
    expect(children[0].type).toBe('TEXT')
    expect(children[0].name).toBe('Title')

    const allNodes = [...graph.getAllNodes()]
    const variableNodes = allNodes.filter(n => n.name.includes('Primitives') || n.name.includes('Colors/'))
    expect(variableNodes).toHaveLength(0)
  })

  it('skips non-visual Figma types', () => {
    const { graph, pageId } = createGraphWithPage()

    const nonVisualTypes = ['WIDGET', 'STAMP', 'STICKY', 'CONNECTOR', 'CODE_BLOCK', 'SHAPE_WITH_TEXT', 'TABLE_NODE', 'TABLE_CELL']
    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page' },
      ...nonVisualTypes.map((type, i) => ({
        guid: { sessionID: 0, localID: 100 + i },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: String.fromCharCode(33 + i) },
        type,
        name: `${type}_node`,
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      })),
      { guid: { sessionID: 0, localID: 200 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: 'z' }, type: 'RECTANGLE', name: 'RealShape', size: { x: 50, y: 50 }, transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 } },
    ] as any[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)
    expect(graph.getNode(created[0])!.name).toBe('RealShape')
  })

  it('imports nested frames with children', () => {
    const { graph, pageId } = createGraphWithPage()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page' },
      { guid: { sessionID: 0, localID: 10 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' }, type: 'FRAME', name: 'Outer', size: { x: 400, y: 300 }, transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 } },
      { guid: { sessionID: 0, localID: 11 }, parentIndex: { guid: { sessionID: 0, localID: 10 }, position: '!' }, type: 'FRAME', name: 'Inner', size: { x: 200, y: 100 }, transform: { m00: 1, m01: 0, m02: 20, m10: 0, m11: 1, m12: 20 } },
      { guid: { sessionID: 0, localID: 12 }, parentIndex: { guid: { sessionID: 0, localID: 11 }, position: '!' }, type: 'TEXT', name: 'Label', size: { x: 100, y: 20 }, transform: { m00: 1, m01: 0, m02: 5, m10: 0, m11: 1, m12: 5 }, textData: { characters: 'Test' }, fontSize: 14 },
    ] as any[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    expect(created).toHaveLength(1)

    const outer = graph.getNode(created[0])!
    expect(outer.name).toBe('Outer')

    const innerList = graph.getChildren(outer.id)
    expect(innerList).toHaveLength(1)
    expect(innerList[0].name).toBe('Inner')

    const labels = graph.getChildren(innerList[0].id)
    expect(labels).toHaveLength(1)
    expect(labels[0].name).toBe('Label')
    expect(labels[0].text).toBe('Test')
  })

  it('preserves fills and strokes', () => {
    const { graph, pageId } = createGraphWithPage()

    const nodeChanges = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page' },
      {
        guid: { sessionID: 0, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Colored',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        fillPaints: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
        strokePaints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 }, opacity: 1, visible: true }],
        strokeWeight: 2,
      },
    ] as any[]

    const created = importClipboardNodes(nodeChanges, graph, pageId)
    const node = graph.getNode(created[0])!
    expect(node.fills).toHaveLength(1)
    expect(node.fills[0].color.r).toBe(1)
    expect(node.strokes).toHaveLength(1)
    expect(node.strokes[0].color.b).toBe(1)
    expect(node.strokes[0].weight).toBe(2)
  })
})

describe('figmaNodesBounds', () => {
  it('computes bounds of top-level visual nodes', () => {
    const nodes = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page' },
      { guid: { sessionID: 0, localID: 10 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' }, type: 'FRAME', name: 'A', size: { x: 200, y: 100 }, transform: { m00: 1, m01: 0, m02: 500, m10: 0, m11: 1, m12: 300 } },
      { guid: { sessionID: 0, localID: 11 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' }, type: 'RECTANGLE', name: 'B', size: { x: 50, y: 50 }, transform: { m00: 1, m01: 0, m02: 800, m10: 0, m11: 1, m12: 400 } },
    ] as any[]

    const bounds = figmaNodesBounds(nodes)
    expect(bounds).toEqual({ x: 500, y: 300, w: 350, h: 150 })
  })

  it('ignores variables and non-visual types', () => {
    const nodes = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page' },
      { guid: { sessionID: 0, localID: 2 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' }, type: 'VARIABLE_SET', name: 'Vars' },
      { guid: { sessionID: 0, localID: 10 }, parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' }, type: 'FRAME', name: 'Card', size: { x: 300, y: 200 }, transform: { m00: 1, m01: 0, m02: 18000, m10: 0, m11: 1, m12: 45000 } },
    ] as any[]

    const bounds = figmaNodesBounds(nodes)
    expect(bounds).toEqual({ x: 18000, y: 45000, w: 300, h: 200 })
  })

  it('returns null for empty or all-non-visual nodes', () => {
    expect(figmaNodesBounds([])).toBeNull()
    const nodes = [
      { guid: { sessionID: 0, localID: 0 }, type: 'DOCUMENT', name: 'Doc' },
      { guid: { sessionID: 0, localID: 1 }, parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' }, type: 'CANVAS', name: 'Page' },
    ] as any[]
    expect(figmaNodesBounds(nodes)).toBeNull()
  })
})
