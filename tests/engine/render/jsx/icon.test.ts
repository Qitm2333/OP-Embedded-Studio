import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { clearIconCache, renderJSX } from '@open-pencil/core'

import { childIdAt, getNodeOrThrow } from '#tests/helpers/assert'
import { makeSceneGraph } from '#tests/helpers/scene'

describe('Design JSX icons', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => clearIconCache())

  afterEach(() => {
    clearIconCache()
    globalThis.fetch = originalFetch
  })

  it('defaults bare icon names to the lucide collection', async () => {
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      expect(url.pathname).toBe('/lucide.json')
      expect(url.searchParams.get('icons')).toBe('wifi')
      return new Response(
        JSON.stringify({
          prefix: 'lucide',
          width: 24,
          height: 24,
          icons: {
            wifi: {
              body: '<path fill="none" stroke="currentColor" stroke-width="2" d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>'
            }
          }
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }

    const graph = makeSceneGraph()
    const [result] = await renderJSX(
      graph,
      '<Frame w={100} h={100}><Icon name="wifi" size={24} color="#FFFFFF" /></Frame>'
    )
    const frame = getNodeOrThrow(graph, result.id)
    const icon = getNodeOrThrow(graph, childIdAt(frame, 0))

    expect(icon.name).toBe('Icon / lucide:wifi')
    expect(icon.type).toBe('FRAME')
    expect(icon.childIds.length).toBeGreaterThan(0)
  })
})
