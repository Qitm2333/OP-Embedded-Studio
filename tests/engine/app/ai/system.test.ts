import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import {
  createDesignContextPrompt,
  createSystemPrompt,
  DESIGN_SYSTEM_PROMPT,
  resolveDesignTargetFrame
} from '@/app/ai/chat/system'
import { createEditorStore } from '@/app/editor/session'

describe('Design AI current Frame context', () => {
  test('uses the sole top-level Frame when selection is empty', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, {
      name: 'Current Screen',
      width: 240,
      height: 240
    })
    const store = createEditorStore(graph)

    expect(resolveDesignTargetFrame(store)?.id).toBe(frame.id)
    expect(createSystemPrompt(store)).toContain(`"Current Screen" (${frame.id})`)
    expect(createSystemPrompt(store)).not.toContain('name="Current Screen"')
  })

  test('resolves selected descendants to their top-level screen Frame', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const first = graph.createNode('FRAME', pageId, { name: 'First Screen' })
    const second = graph.createNode('FRAME', pageId, { name: 'Second Screen' })
    const nested = graph.createNode('FRAME', second.id, { name: 'Card' })
    const label = graph.createNode('TEXT', nested.id, { characters: 'Value' })
    const store = createEditorStore(graph)
    store.select([label.id])

    expect(resolveDesignTargetFrame(store)?.id).toBe(second.id)
    expect(resolveDesignTargetFrame(store)?.id).not.toBe(first.id)
  })

  test('does not guess when selections span multiple screens', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const first = graph.createNode('FRAME', pageId, { name: 'First Screen' })
    const second = graph.createNode('FRAME', pageId, { name: 'Second Screen' })
    const firstChild = graph.createNode('RECTANGLE', first.id)
    const secondChild = graph.createNode('RECTANGLE', second.id)
    const store = createEditorStore(graph)
    store.select([firstChild.id, secondChild.id])

    expect(resolveDesignTargetFrame(store)).toBeUndefined()
  })

  test('adds only a compact embedded target to the stable prompt', () => {
    const graph = new SceneGraph()
    const store = createEditorStore(graph)
    const system = createSystemPrompt(store)

    expect(system.startsWith(DESIGN_SYSTEM_PROMPT)).toBe(true)
    expect(system).toContain('# OP Embedded Studio target')
    expect(system).not.toContain('# Current complete Design JSX')
  })

  test('provides deterministic safe bounds for the default 466 round screen', () => {
    const graph = new SceneGraph()
    const store = createEditorStore(graph)
    const context = createDesignContextPrompt(store)

    expect(context).toContain('center (233, 233), physical radius 233')
    expect(context).toContain('x=80, y=80, w=306, h=306')
    expect(context).toContain('no screenshot is required')
  })
})
