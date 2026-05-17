import { describe, expect, test } from 'bun:test'

import { importNodeChanges } from '#core/kiwi/fig/import'
import type { NodeChange } from '#core/kiwi/binary/codec'

const documentGuid = { sessionID: 0, localID: 0 }
const pageGuid = { sessionID: 0, localID: 1 }
const componentGuid = { sessionID: 1, localID: 1 }
const componentTextGuid = { sessionID: 1, localID: 2 }
const instanceGuid = { sessionID: 2, localID: 1 }
const textPropGuid = { sessionID: 3, localID: 1 }

function baseTextChange(): NodeChange {
  return {
    guid: componentTextGuid,
    phase: 'CREATED',
    parentIndex: { guid: componentGuid, position: '!' },
    type: 'TEXT',
    name: 'Label',
    size: { x: 100, y: 20 },
    transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
    fontSize: 14,
    fontName: { family: 'Inter', style: 'Regular', postscript: '' },
    textData: { characters: 'Menu Item', lines: [{ lineType: 'PLAIN' }] },
    componentPropRefs: [{ defID: textPropGuid, componentPropNodeField: 'TEXT_DATA' }]
  }
}

describe('Figma component property import', () => {
  test('applies text data component prop assignments', () => {
    const nodeChanges: NodeChange[] = [
      { guid: documentGuid, phase: 'CREATED', type: 'DOCUMENT', name: 'Document' },
      { guid: pageGuid, phase: 'CREATED', parentIndex: { guid: documentGuid, position: '!' }, type: 'CANVAS', name: 'Page' },
      {
        guid: componentGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '!' },
        type: 'SYMBOL',
        name: 'Menu item',
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
        componentPropDefs: [
          { id: textPropGuid, name: 'label', initialValue: { textValue: 'Menu Item' } }
        ]
      },
      baseTextChange(),
      {
        guid: instanceGuid,
        phase: 'CREATED',
        parentIndex: { guid: pageGuid, position: '"' },
        type: 'INSTANCE',
        name: 'Menu item instance',
        symbolData: { symbolID: componentGuid },
        size: { x: 100, y: 20 },
        transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 40 },
        componentPropAssignments: [
          {
            defID: textPropGuid,
            value: { textValue: { characters: 'Profile Item' } },
            varValue: { value: { textDataValue: { characters: 'Profile Item' } } }
          }
        ]
      }
    ]

    const graph = importNodeChanges(nodeChanges, [], undefined, { populate: 'all' })
    const labels = Array.from(graph.getAllNodes()).filter((node) => node.type === 'TEXT')
    expect(labels.map((node) => node.text).sort()).toEqual(['Menu Item', 'Profile Item'])
  })
})
