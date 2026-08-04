import { describe, expect, test } from 'bun:test'

import { useDevicePrototype } from '@/features/device-prototype'

describe('device prototype interactions', () => {
  test('creates and selects an AI-proposed interaction in the shared Interaction panel state', () => {
    const prototype = useDevicePrototype()
    const interaction = prototype.createInteractionFromDefinition({
      name: 'AI Navigation',
      definition: {
        initialStateId: 'home',
        states: [
          { id: 'home', frameId: 'home', name: 'Home', width: 466, height: 466 },
          { id: 'detail', frameId: 'detail', name: 'Detail', width: 466, height: 466 }
        ],
        transitions: [
          { fromStateId: 'home', event: 'screen_click', toStateId: 'detail' },
          { fromStateId: 'detail', event: 'boot_click', toStateId: 'home' }
        ]
      }
    })

    expect(prototype.selectedInteractionId.value).toBe(interaction.id)
    expect(prototype.selectedInteraction.value?.name).toBe('AI Navigation')
    expect(prototype.states.value.map((state) => state.frameId)).toEqual(['home', 'detail'])
    expect(prototype.definition(interaction.id)?.transitions).toHaveLength(2)

    prototype.removeInteraction(interaction.id)
  })

  test('rejects ambiguous duplicate transitions', () => {
    const prototype = useDevicePrototype()
    expect(() =>
      prototype.createInteractionFromDefinition({
        name: 'Invalid interaction',
        definition: {
          initialStateId: 'a',
          states: [
            { id: 'a', frameId: 'a', name: 'A', width: 240, height: 240 },
            { id: 'b', frameId: 'b', name: 'B', width: 240, height: 240 }
          ],
          transitions: [
            { fromStateId: 'a', event: 'screen_click', toStateId: 'b' },
            { fromStateId: 'a', event: 'screen_click', toStateId: 'a' }
          ]
        }
      })
    ).toThrow('同一 Frame 的同一事件只能设置一个目标')
  })

  test('accepts interaction states with different source dimensions', () => {
    const prototype = useDevicePrototype()
    const interaction = prototype.createInteractionFromDefinition({
      name: 'Mixed source sizes',
      definition: {
        initialStateId: 'small',
        states: [
          { id: 'small', frameId: 'small', name: 'Small', width: 240, height: 200 },
          { id: 'large', frameId: 'large', name: 'Large', width: 500, height: 480 }
        ],
        transitions: [
          { fromStateId: 'small', event: 'screen_click', toStateId: 'large' },
          { fromStateId: 'large', event: 'screen_click', toStateId: 'small' }
        ]
      }
    })

    expect(prototype.definition(interaction.id)?.states.map((state) => state.width)).toEqual([
      240, 500
    ])
    expect(
      prototype.interactionOptions.value.find((option) => option.id === interaction.id)?.valid
    ).toBe(true)
    prototype.removeInteraction(interaction.id)
  })
})
