import { describe, expect, test } from 'bun:test'

import { buildDsdLayoutUpdates } from '#core/kiwi/instance-overrides/derived-symbol-data/layout'
import type { OverrideContext } from '#core/kiwi/instance-overrides'
import { SceneGraph } from '#core/scene-graph'

function pageId(graph: SceneGraph): string {
  return graph.getPages()[0].id
}

describe('fig import derived symbol data', () => {
  test('routes derived text glyphs through layout patch updates', () => {
    const graph = new SceneGraph()
    const target = graph.createNode('TEXT', pageId(graph), { text: 'Menu Item' })
    const glyphBlob = new Uint8Array([0])
    const ctx = {
      graph,
      blobs: [glyphBlob]
    } as OverrideContext

    const { updates } = buildDsdLayoutUpdates(
      ctx,
      new Map(),
      {
        derivedTextData: {
          layoutSize: { x: 64, y: 20 },
          glyphs: [
            {
              commandsBlob: 0,
              position: { x: 4, y: 15 },
              fontSize: 14,
              firstCharacter: 0,
              advance: 1,
              rotation: 0
            }
          ]
        }
      },
      target
    )

    expect(updates.figmaDerivedTextGlyphs).toEqual([
      {
        commandsBlob: glyphBlob,
        x: 4,
        y: 15,
        fontSize: 14
      }
    ])
  })
})
