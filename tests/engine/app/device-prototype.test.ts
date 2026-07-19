import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'

import { getDevicePrototypeFrameCandidate } from '@/app/editor/device-prototype'
import type { EditorStore } from '@/app/editor/session'
import { useDevicePrototype } from '@/features/device-prototype'

describe('device prototype interaction flow', () => {
  test('keeps transitions consistent when targets are selected, cleared, or removed', () => {
    const prototype = useDevicePrototype()
    prototype.addInteraction()

    const interactionId = prototype.selectedInteractionId.value
    const firstState = {
      available: true,
      id: 'prototype-test-frame-a',
      name: 'Frame A',
      width: 240,
      height: 240
    }
    const secondState = {
      available: true,
      id: 'prototype-test-frame-b',
      name: 'Frame B',
      width: 240,
      height: 240
    }

    prototype.addFrame(firstState)
    prototype.addFrame(secondState)

    expect(prototype.initialStateId.value).toBe(firstState.id)
    expect(prototype.interactionOptions.value.find((option) => option.id === interactionId)).toMatchObject({
      stateCount: 2,
      initialStateName: firstState.name,
      valid: true
    })

    prototype.setTransition(firstState.id, 'screen_click', secondState.id)
    expect(prototype.transitionTarget(firstState.id, 'screen_click')).toBe(secondState.id)
    expect(prototype.definition(interactionId)?.transitions).toEqual([
      {
        fromStateId: firstState.id,
        event: 'screen_click',
        toStateId: secondState.id
      }
    ])

    prototype.setTransition(firstState.id, 'screen_click', '')
    expect(prototype.transitionTarget(firstState.id, 'screen_click')).toBe('')
    expect(prototype.definition(interactionId)?.transitions).toEqual([])

    prototype.setTransition(firstState.id, 'screen_click', secondState.id)
    prototype.removeState(secondState.id)
    expect(prototype.definition(interactionId)).toMatchObject({
      initialStateId: firstState.id,
      states: [{ id: firstState.id }],
      transitions: []
    })
  })
  test('resolves selected descendants to their nearest containing frame', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const frame = graph.createNode('FRAME', pageId, {
      name: 'Screen Frame',
      width: 240,
      height: 240
    })
    const group = graph.createNode('GROUP', frame.id, { width: 120, height: 120 })
    const firstChild = graph.createNode('RECTANGLE', group.id, { width: 40, height: 40 })
    const secondChild = graph.createNode('TEXT', frame.id, { width: 80, height: 20 })

    const store = {
      graph,
      state: {
        selectedIds: new Set([firstChild.id, secondChild.id]),
        sceneVersion: 0
      }
    } as unknown as EditorStore

    expect(getDevicePrototypeFrameCandidate(store)).toEqual({
      available: true,
      id: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height
    })
  })

  test('rejects selections outside a frame or across different frames', () => {
    const graph = new SceneGraph()
    const pageId = graph.getPages()[0].id
    const firstFrame = graph.createNode('FRAME', pageId, { width: 240, height: 240 })
    const secondFrame = graph.createNode('FRAME', pageId, { width: 240, height: 240 })
    const firstChild = graph.createNode('RECTANGLE', firstFrame.id, { width: 40, height: 40 })
    const secondChild = graph.createNode('RECTANGLE', secondFrame.id, { width: 40, height: 40 })
    const topLevel = graph.createNode('RECTANGLE', pageId, { width: 40, height: 40 })
    const store = {
      graph,
      state: {
        selectedIds: new Set<string>(),
        sceneVersion: 0
      }
    } as unknown as EditorStore

    store.state.selectedIds = new Set([firstChild.id, secondChild.id])
    expect(getDevicePrototypeFrameCandidate(store)).toMatchObject({
      available: false,
      reason: '选中的对象属于不同 Frame'
    })

    store.state.selectedIds = new Set([topLevel.id])
    expect(getDevicePrototypeFrameCandidate(store)).toMatchObject({
      available: false,
      reason: '当前选中对象不在 Frame 内'
    })
  })
})