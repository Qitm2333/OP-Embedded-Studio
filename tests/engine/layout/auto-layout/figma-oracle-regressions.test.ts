import { describe, expect, test } from 'bun:test'

import { computeAllLayouts, SceneGraph } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, pageId, rect } from '#tests/helpers/layout'

describe('Figma auto-layout oracle regressions', () => {
  test('deleting a trailing child reflows fill siblings in fixed vertical auto-layout', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const frame = autoFrame(graph, page, {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 300,
      itemSpacing: 0
    })
    rect(graph, frame.id, 300, 40, { name: 'header h40' })
    const body = rect(graph, frame.id, 300, 100, { name: 'body fill', layoutGrow: 1 })
    const footerA = rect(graph, frame.id, 300, 40, { name: 'footerA h40' })
    const footerB = rect(graph, frame.id, 300, 40, { name: 'footerB h40' })

    computeAllLayouts(graph, page)
    expect(getNodeOrThrow(graph, body.id).height).toBe(180)
    expect(getNodeOrThrow(graph, footerA.id).y).toBe(220)

    graph.deleteNode(footerB.id)
    computeAllLayouts(graph, page)

    expect(getNodeOrThrow(graph, body.id).height).toBe(220)
    expect(getNodeOrThrow(graph, footerA.id).y).toBe(260)
    expect(getNodeOrThrow(graph, frame.id).height).toBe(300)
  })

  test('hidden child in HUG auto-layout instance is excluded from layout', () => {
    const graph = new SceneGraph()
    const page = pageId(graph)
    const component = graph.createNode('COMPONENT', page, {
      name: 'Optional slot component',
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 300,
      height: 1,
      itemSpacing: 0
    })
    rect(graph, component.id, 300, 40, { name: 'Slot / Pinned at Top' })
    rect(graph, component.id, 300, 74, { name: 'Slot / Content' })
    rect(graph, component.id, 300, 40, { name: 'Slot / Pinned at Bottom' })
    const instance = graph.createInstance(component.id, page, { x: 360, y: 0 })
    if (!instance) throw new Error('Expected instance to be created')

    computeAllLayouts(graph, page)
    expect(getNodeOrThrow(graph, instance.id).height).toBe(154)
    const content = graph.getChildren(instance.id).find((child) => child.name === 'Slot / Content')
    const bottom = graph
      .getChildren(instance.id)
      .find((child) => child.name === 'Slot / Pinned at Bottom')
    if (!content || !bottom) throw new Error('Expected instance slot children')
    expect(getNodeOrThrow(graph, bottom.id).y).toBe(114)

    graph.updateNode(content.id, { visible: false })
    computeAllLayouts(graph, page)

    expect(getNodeOrThrow(graph, instance.id).height).toBe(80)
    expect(getNodeOrThrow(graph, bottom.id).y).toBe(40)
    expect(getNodeOrThrow(graph, content.id).height).toBe(74)
  })
})
