import { describe, test, expect, beforeAll, setDefaultTimeout } from 'bun:test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { parseFigFile } from '../../packages/core/src/kiwi/fig-file'
import { exportFigFile } from '../../packages/core/src/fig-export'
import { initCodec } from '../../packages/core/src/kiwi/codec'
import { SceneGraph } from '../../packages/core/src/scene-graph'

import type { SceneNode, NodeType, Fill } from '../../packages/core/src/scene-graph'

setDefaultTimeout(60_000)

const FIXTURES = resolve(import.meta.dir, '../fixtures')

const VALID_NODE_TYPES = new Set<string>([
  'CANVAS',
  'FRAME',
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'ELLIPSE',
  'TEXT',
  'LINE',
  'STAR',
  'POLYGON',
  'VECTOR',
  'GROUP',
  'SECTION',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'CONNECTOR',
  'SHAPE_WITH_TEXT',
])

function collectAllNodes(graph: SceneGraph): SceneNode[] {
  const all: SceneNode[] = []
  function walk(id: string) {
    const node = graph.getNode(id)
    if (!node) return
    all.push(node)
    for (const child of graph.getChildren(id)) {
      walk(child.id)
    }
  }
  for (const page of graph.getPages()) {
    for (const child of graph.getChildren(page.id)) {
      walk(child.id)
    }
  }
  return all
}

function countByType(nodes: SceneNode[]): Map<NodeType, number> {
  const counts = new Map<NodeType, number>()
  for (const n of nodes) {
    counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
  }
  return counts
}

// Parse fixtures once — they're large
let material3: SceneGraph
let nuxtui: SceneGraph
let material3Nodes: SceneNode[]
let nuxtUiNodes: SceneNode[]

beforeAll(async () => {
  const m3Buf = readFileSync(resolve(FIXTURES, 'material3.fig'))
  const nuBuf = readFileSync(resolve(FIXTURES, 'nuxtui.fig'))
  material3 = await parseFigFile(m3Buf.buffer as ArrayBuffer)
  nuxtui = await parseFigFile(nuBuf.buffer as ArrayBuffer)
  material3Nodes = collectAllNodes(material3)
  nuxtUiNodes = collectAllNodes(nuxtui)
})

describe('parse real .fig files', () => {
  test('material3.fig parses without error', () => {
    expect(material3).toBeInstanceOf(SceneGraph)
  })

  test('nuxtui.fig parses without error', () => {
    expect(nuxtui).toBeInstanceOf(SceneGraph)
  })

  test('material3.fig has pages', () => {
    expect(material3.getPages().length).toBeGreaterThan(0)
  })

  test('material3.fig has nodes', () => {
    expect(material3Nodes.length).toBeGreaterThan(0)
  })

  test('nuxtui.fig has pages', () => {
    expect(nuxtui.getPages().length).toBeGreaterThan(0)
  })

  test('nuxtui.fig has nodes', () => {
    expect(nuxtUiNodes.length).toBeGreaterThan(0)
  })
})

describe('node type coverage', () => {
  test('material3: contains FRAME nodes', () => {
    expect(material3Nodes.some((n) => n.type === 'FRAME')).toBe(true)
  })

  test('material3: contains TEXT nodes with content', () => {
    const textNodes = material3Nodes.filter((n) => n.type === 'TEXT')
    expect(textNodes.length).toBeGreaterThan(0)
    expect(textNodes.some((n) => n.text.length > 0)).toBe(true)
  })

  test('material3: contains COMPONENT nodes', () => {
    expect(material3Nodes.some((n) => n.type === 'COMPONENT')).toBe(true)
  })

  test('material3: contains INSTANCE nodes', () => {
    expect(material3Nodes.some((n) => n.type === 'INSTANCE')).toBe(true)
  })

  test('material3: no unmapped node types', () => {
    const invalid = material3Nodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })

  test('nuxtui: no unmapped node types', () => {
    const invalid = nuxtUiNodes.filter((n) => !VALID_NODE_TYPES.has(n.type))
    expect(invalid.map((n) => `${n.name}: ${n.type}`)).toEqual([])
  })
})

describe('property integrity', () => {
  test('all nodes have finite dimensions', () => {
    for (const n of material3Nodes) {
      expect(Number.isFinite(n.width)).toBe(true)
      expect(Number.isFinite(n.height)).toBe(true)
      expect(n.width).toBeGreaterThanOrEqual(0)
      expect(n.height).toBeGreaterThanOrEqual(0)
    }
  })

  test('all nodes have finite positions', () => {
    for (const n of material3Nodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })

  test('all nodes have valid opacity', () => {
    for (const n of material3Nodes) {
      expect(n.opacity).toBeGreaterThanOrEqual(0)
      expect(n.opacity).toBeLessThanOrEqual(1)
    }
  })

  test('TEXT nodes have fontFamily', () => {
    for (const n of material3Nodes) {
      if (n.type === 'TEXT') {
        expect(typeof n.fontFamily).toBe('string')
        expect(n.fontFamily.length).toBeGreaterThan(0)
      }
    }
  })

  test('TEXT nodes have valid fontSize', () => {
    for (const n of material3Nodes) {
      if (n.type === 'TEXT') {
        expect(n.fontSize).toBeGreaterThan(0)
      }
    }
  })

  test('fills have valid colors', () => {
    function checkFill(fill: Fill, nodeName: string) {
      if (fill.type === 'SOLID') {
        const { r, g, b, a } = fill.color
        expect(r).toBeGreaterThanOrEqual(0)
        expect(r).toBeLessThanOrEqual(1)
        expect(g).toBeGreaterThanOrEqual(0)
        expect(g).toBeLessThanOrEqual(1)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThanOrEqual(1)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(1)
      }
    }
    for (const n of material3Nodes) {
      for (const fill of n.fills) {
        checkFill(fill, n.name)
      }
    }
  })

  test('effects have valid radius', () => {
    for (const n of material3Nodes) {
      for (const e of n.effects) {
        expect(e.radius).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('layout nodes have valid spacing', () => {
    for (const n of material3Nodes) {
      if (n.layoutMode !== 'NONE') {
        expect(Number.isFinite(n.itemSpacing)).toBe(true)
        expect(n.paddingTop).toBeGreaterThanOrEqual(0)
        expect(n.paddingRight).toBeGreaterThanOrEqual(0)
        expect(n.paddingBottom).toBeGreaterThanOrEqual(0)
        expect(n.paddingLeft).toBeGreaterThanOrEqual(0)
      }
    }
  })

  test('nuxtui: fills have valid colors', () => {
    for (const n of nuxtUiNodes) {
      for (const fill of n.fills) {
        if (fill.type === 'SOLID') {
          expect(fill.color.r).toBeGreaterThanOrEqual(0)
          expect(fill.color.r).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('roundtrip: export → re-import', () => {
  let reImported: SceneGraph
  let reImportedNodes: SceneNode[]

  beforeAll(async () => {
    await initCodec()

    const graph = new SceneGraph()
    const page1 = graph.getPages()[0]
    const page2 = graph.addPage('Second Page')

    graph.createNode('FRAME', page1.id, {
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
      layoutMode: 'VERTICAL',
      itemSpacing: 16,
      paddingTop: 24,
      paddingRight: 24,
      paddingBottom: 24,
      paddingLeft: 24,
      cornerRadius: 12,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
    })

    const container = graph.getChildren(page1.id)[0]

    graph.createNode('RECTANGLE', container.id, {
      name: 'Header BG',
      x: 0,
      y: 0,
      width: 400,
      height: 80,
      cornerRadius: 8,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      independentCorners: true,
      fills: [
        { type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' },
        {
          type: 'GRADIENT_LINEAR',
          color: { r: 0, g: 0, b: 0, a: 0 },
          opacity: 0.5,
          visible: true,
          blendMode: 'NORMAL',
          gradientStops: [
            { color: { r: 1, g: 1, b: 1, a: 1 }, position: 0 },
            { color: { r: 0, g: 0, b: 0, a: 0 }, position: 1 },
          ],
          gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        },
      ],
      effects: [
        { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0, visible: true, blendMode: 'NORMAL' },
      ],
    })

    graph.createNode('TEXT', container.id, {
      name: 'Title',
      x: 24,
      y: 100,
      width: 352,
      height: 24,
      text: 'Hello World',
      fontSize: 18,
      fontFamily: 'Inter',
      fontWeight: 700,
      textAlignHorizontal: 'CENTER',
    })

    graph.createNode('ELLIPSE', container.id, {
      name: 'Circle',
      x: 176,
      y: 140,
      width: 48,
      height: 48,
      fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.1, b: 0.3, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }],
    })

    graph.createNode('RECTANGLE', page2.id, {
      name: 'Page2 Rect',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
    })

    const figBytes = await exportFigFile(graph)
    reImported = await parseFigFile(figBytes.buffer as ArrayBuffer)
    reImportedNodes = collectAllNodes(reImported)
  })

  test('preserves page count', () => {
    expect(reImported.getPages().length).toBe(2)
  })

  test('preserves page names', () => {
    const names = reImported.getPages().map((p) => p.name)
    expect(names).toContain('Page 1')
    expect(names).toContain('Second Page')
  })

  test('preserves node count', () => {
    // 1 frame + 1 rect + 1 text + 1 ellipse + 1 rect on page 2 = 5
    expect(reImportedNodes.length).toBe(5)
  })

  test('preserves node types', () => {
    const types = countByType(reImportedNodes)
    expect(types.get('FRAME')).toBe(1)
    expect(types.get('RECTANGLE')).toBe(2)
    expect(types.get('TEXT')).toBe(1)
    expect(types.get('ELLIPSE')).toBe(1)
  })

  test('preserves node names', () => {
    const names = new Set(reImportedNodes.map((n) => n.name))
    expect(names.has('Container')).toBe(true)
    expect(names.has('Header BG')).toBe(true)
    expect(names.has('Title')).toBe(true)
    expect(names.has('Circle')).toBe(true)
    expect(names.has('Page2 Rect')).toBe(true)
  })

  test('preserves fills', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')!
    expect(headerBg.fills).toHaveLength(2)
    expect(headerBg.fills[0].type).toBe('SOLID')
    expect(headerBg.fills[0].color.r).toBeCloseTo(0.2, 1)
    expect(headerBg.fills[1].type).toBe('GRADIENT_LINEAR')
    expect(headerBg.fills[1].opacity).toBeCloseTo(0.5, 1)
    expect(headerBg.fills[1].gradientStops).toHaveLength(2)
  })

  test('preserves text content', () => {
    const title = reImportedNodes.find((n) => n.name === 'Title')!
    expect(title.text).toBe('Hello World')
  })

  test('preserves text properties', () => {
    const title = reImportedNodes.find((n) => n.name === 'Title')!
    expect(title.fontSize).toBe(18)
    expect(title.fontFamily).toBe('Inter')
    expect(title.fontWeight).toBe(700)
    expect(title.textAlignHorizontal).toBe('CENTER')
  })

  test('preserves layout mode', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.layoutMode).toBe('VERTICAL')
  })

  test('preserves layout spacing', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.itemSpacing).toBe(16)
    expect(container.paddingTop).toBe(24)
    expect(container.paddingRight).toBe(24)
    expect(container.paddingBottom).toBe(24)
    expect(container.paddingLeft).toBe(24)
  })

  test('preserves corner radius', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.cornerRadius).toBe(12)
  })

  test('preserves independent corner radii', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')!
    expect(headerBg.independentCorners).toBe(true)
    expect(headerBg.topLeftRadius).toBe(8)
    expect(headerBg.topRightRadius).toBe(8)
    expect(headerBg.bottomRightRadius).toBe(0)
    expect(headerBg.bottomLeftRadius).toBe(0)
  })

  test('preserves effects', () => {
    const headerBg = reImportedNodes.find((n) => n.name === 'Header BG')!
    expect(headerBg.effects).toHaveLength(1)
    expect(headerBg.effects[0].type).toBe('DROP_SHADOW')
    expect(headerBg.effects[0].radius).toBe(8)
    expect(headerBg.effects[0].offset.y).toBe(4)
  })

  test('preserves dimensions', () => {
    const container = reImportedNodes.find((n) => n.name === 'Container')!
    expect(container.width).toBe(400)
    expect(container.height).toBe(300)
  })
})

describe('edge cases', () => {
  test('non-fig-kiwi bytes throw meaningful error', async () => {
    const garbage = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    await expect(parseFigFile(garbage.buffer as ArrayBuffer)).rejects.toThrow()
  })

  test('invalid zip data throws', async () => {
    const garbage = new Uint8Array(50).fill(0xff)
    await expect(parseFigFile(garbage.buffer as ArrayBuffer)).rejects.toThrow()
  })

  test('REMOVED nodes are skipped', async () => {
    const { importNodeChanges } = await import('../../packages/core/src/kiwi/fig-import')
    const graph = importNodeChanges([
      {
        guid: { sessionID: 0, localID: 0 },
        type: 'DOCUMENT',
        name: 'Document',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 0, localID: 1 },
        parentIndex: { guid: { sessionID: 0, localID: 0 }, position: '!' },
        type: 'CANVAS',
        name: 'Page',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 1, localID: 10 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '!' },
        type: 'RECTANGLE',
        name: 'Visible',
        visible: true,
        opacity: 1,
        phase: 'CREATED',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
      {
        guid: { sessionID: 1, localID: 11 },
        parentIndex: { guid: { sessionID: 0, localID: 1 }, position: '"' },
        type: 'RECTANGLE',
        name: 'Deleted',
        visible: true,
        opacity: 1,
        phase: 'REMOVED',
        size: { x: 100, y: 100 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
      },
    ])
    const children = graph.getChildren(graph.getPages()[0].id)
    expect(children).toHaveLength(1)
    expect(children[0].name).toBe('Visible')
  })
})
