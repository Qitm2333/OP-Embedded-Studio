import { describe, expect, it } from 'bun:test'

import { renderJSX } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

describe('Design JSX custom vector paths', () => {
  it('renders SVG path data in a Vector node', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Vector name="Bolt" w={80} h={120} d="M50 0 L12 66 H42 L32 120 L72 52 H47 Z" fill="#BEEAFF" designRole="content" />'
    )
    const node = getNodeOrThrow(graph, result.id)

    expect(node.type).toBe('VECTOR')
    expect(node.vectorNetwork?.vertices.length).toBeGreaterThan(0)
    expect(result.warnings ?? []).toEqual([])
  })

  it('accepts path as an alias for Vector path data', async () => {
    const standardGraph = makeSceneGraph()
    const aliasGraph = makeSceneGraph()
    const pathData = 'M 233 93 A 140 140 0 1 1 93 233'
    const [standardResult] = await renderJSX(
      standardGraph,
      `<Vector w={280} h={280} d="${pathData}" />`
    )
    const [aliasResult] = await renderJSX(
      aliasGraph,
      `<Vector w={280} h={280} path="${pathData}" />`
    )
    const standard = getNodeOrThrow(standardGraph, standardResult.id)
    const alias = getNodeOrThrow(aliasGraph, aliasResult.id)

    expect(alias.type).toBe('VECTOR')
    expect(alias.vectorNetwork).toEqual(standard.vectorNetwork)
  })

  it('renders object-form shadows used by code agents', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Rectangle w={40} h={40} fill="#BEEAFF" shadow={{ color: "#74CFFF", blur: 12, x: 2, y: 3 }} />'
    )
    const node = getNodeOrThrow(graph, result.id)

    expect(node.effects[0]).toMatchObject({
      type: 'DROP_SHADOW',
      radius: 12,
      offset: { x: 2, y: 3 }
    })
  })

  it('accepts SVG path markup emitted inside Design JSX', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<svg name="Bolt" w={80} h={120}><path d="M50 0 L12 66 H42 L32 120 L72 52 H47 Z" fill="#BEEAFF" /></svg>'
    )
    const root = getNodeOrThrow(graph, result.id)
    const path = getNodeOrThrow(graph, root.childIds[0])

    expect(root.type).toBe('GROUP')
    expect(path.type).toBe('VECTOR')
    expect(path.vectorNetwork?.vertices.length).toBeGreaterThan(0)
  })

  it('extracts path data accidentally wrapped in SVG markup', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      `<Vector w={80} h={120} d={'<path d="M0 0 L40 80 L80 0 Z" />'} fill="#BEEAFF" />`
    )
    const node = getNodeOrThrow(graph, result.id)

    expect(node.type).toBe('VECTOR')
    expect(node.vectorNetwork?.vertices.length).toBeGreaterThan(0)
  })

  it('normalizes coordinate-only Vector path data', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Vector w={80} h={120} d="40,0 0,120 80,120" fill="#BEEAFF" />'
    )
    const node = getNodeOrThrow(graph, result.id)

    expect(node.type).toBe('VECTOR')
    expect(node.vectorNetwork?.vertices.length).toBe(3)
  })

  it('rejects coordinate strings passed to regular Polygon', async () => {
    const graph = makeSceneGraph()

    await expect(
      renderJSX(graph, '<Polygon w={80} h={120} points="50,0 12,66 42,66" fill="#BEEAFF" />')
    ).rejects.toThrow('use <Vector')
  })
})
