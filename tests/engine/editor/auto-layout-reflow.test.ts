import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { autoFrame, rect } from '#tests/helpers/layout'

describe('editor auto-layout reflow', () => {
  test('deleteSelected reflows fixed vertical auto-layout siblings', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const frame = autoFrame(editor.graph, page, {
      layoutMode: 'VERTICAL',
      width: 300,
      height: 300,
      itemSpacing: 0
    })
    rect(editor.graph, frame.id, 300, 40)
    const body = rect(editor.graph, frame.id, 300, 100, { layoutGrow: 1 })
    const footerA = rect(editor.graph, frame.id, 300, 40)
    const footerB = rect(editor.graph, frame.id, 300, 40)
    computeAllLayouts(editor.graph, page)

    editor.select([footerB.id])
    editor.deleteSelected()

    expect(getNodeOrThrow(editor.graph, body.id).height).toBe(220)
    expect(getNodeOrThrow(editor.graph, footerA.id).y).toBe(260)
  })

  test('toggleNodeVisibility reflows HUG auto-layout instance slots', () => {
    const editor = createEditor()
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'FIXED',
      width: 300,
      height: 1,
      itemSpacing: 0
    })
    rect(editor.graph, component.id, 300, 40, { name: 'Slot / Pinned at Top' })
    rect(editor.graph, component.id, 300, 74, { name: 'Slot / Content' })
    rect(editor.graph, component.id, 300, 40, { name: 'Slot / Pinned at Bottom' })
    const instance = editor.graph.createInstance(component.id, page)
    if (!instance) throw new Error('Expected instance')
    computeAllLayouts(editor.graph, page)

    const content = editor.graph
      .getChildren(instance.id)
      .find((child) => child.name === 'Slot / Content')
    const bottom = editor.graph
      .getChildren(instance.id)
      .find((child) => child.name === 'Slot / Pinned at Bottom')
    if (!content || !bottom) throw new Error('Expected instance slot children')

    editor.toggleNodeVisibility(content.id)

    expect(getNodeOrThrow(editor.graph, instance.id).height).toBe(80)
    expect(getNodeOrThrow(editor.graph, bottom.id).y).toBe(40)
  })
})
