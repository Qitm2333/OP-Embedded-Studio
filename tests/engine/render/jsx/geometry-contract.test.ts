import { describe, expect, test } from 'bun:test'

import { renderJSX } from '@open-pencil/core'

import { getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

describe('Design JSX geometry contract', () => {
  test('rejects SVG positioning props that Design JSX cannot honor', async () => {
    const graph = makeSceneGraph()

    await expect(
      renderJSX(graph, '<Ellipse cx={100} cy={100} rx={50} ry={50} fill="#00FFFF" />')
    ).rejects.toThrow('Unsupported SVG geometry')
  })

  test('rejects centered absolute text without an explicit text box', async () => {
    const graph = makeSceneGraph()

    await expect(
      renderJSX(graph, '<Text x={233} y={180} textAlign="center" color="#FFFFFF">10:24</Text>')
    ).rejects.toThrow('requires an explicit w/width')
  })

  test('accepts centered absolute text with an explicit text box', async () => {
    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Text x={80} y={180} w={306} textAlign="center" color="#FFFFFF">10:24</Text>'
    )
    const node = getNodeOrThrow(graph, result.id)

    expect(node.x).toBe(80)
    expect(node.width).toBe(306)
    expect(node.textAlignHorizontal).toBe('CENTER')
  })
})
