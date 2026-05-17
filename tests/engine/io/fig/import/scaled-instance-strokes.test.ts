import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '@open-pencil/core'
import type { NodeChange } from '#core/kiwi/binary/codec'

import { canvas, doc, node } from './legacy/helpers'

describe('fig import scaled instance strokes', () => {
  test('preserves vector stroke weight while scaling icon geometry', () => {
    const componentGuid = { sessionID: 1, localID: 10 }
    const vectorGuid = { sessionID: 1, localID: 11 }
    const instanceGuid = { sessionID: 1, localID: 20 }

    const graph = importNodeChanges(
      [
        doc(),
        canvas(),
        node('SYMBOL', 10, 1, {
          guid: componentGuid,
          size: { x: 24, y: 24 }
        } as Partial<NodeChange>),
        node('VECTOR', 11, 1, {
          guid: vectorGuid,
          parentIndex: { guid: componentGuid, position: '!' },
          size: { x: 12, y: 12 },
          horizontalConstraint: 'SCALE',
          verticalConstraint: 'SCALE',
          strokeWeight: 2,
          strokePaints: [
            {
              type: 'SOLID',
              color: { r: 0.2, g: 0.25, b: 0.33, a: 1 },
              opacity: 1,
              visible: true,
              blendMode: 'NORMAL'
            }
          ]
        } as Partial<NodeChange>),
        node('INSTANCE', 20, 1, {
          guid: instanceGuid,
          size: { x: 16, y: 16 },
          symbolData: { symbolID: componentGuid }
        } as Partial<NodeChange>)
      ],
      [],
      undefined,
      { populate: 'all' }
    )

    const instance = Array.from(graph.getAllNodes()).find((sceneNode) => sceneNode.name === 'INSTANCE_20')
    const vector = instance?.childIds.map((id) => graph.getNode(id)).find(Boolean)

    expect(vector?.strokes[0]?.weight).toBe(2)
    expect(vector?.strokes[0]?.color).toEqual({ r: 0.2, g: 0.25, b: 0.33, a: 1 })
  })
})
