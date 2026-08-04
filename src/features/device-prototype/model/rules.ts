import type {
  DevicePrototypeInteraction,
  DevicePrototypeManualSettings,
  DevicePrototypeSlideshowSettings,
  DevicePrototypeState,
  DevicePrototypeTransition
} from './types'

export const DEFAULT_DEVICE_PROTOTYPE_MANUAL_SETTINGS: DevicePrototypeManualSettings = {
  nextEvent: 'screen_click',
  previousEvent: 'screen_long_press',
  loop: true
}

export const DEFAULT_DEVICE_PROTOTYPE_SLIDESHOW_SETTINGS: DevicePrototypeSlideshowSettings = {
  intervalMs: 3000
}

export function normalizeSlideshowInterval(intervalMs: number): number {
  if (!Number.isFinite(intervalMs)) return DEFAULT_DEVICE_PROTOTYPE_SLIDESHOW_SETTINGS.intervalMs
  return Math.min(60000, Math.max(500, Math.round(intervalMs / 100) * 100))
}

export function buildManualTransitions(
  states: DevicePrototypeState[],
  settings: DevicePrototypeManualSettings
): DevicePrototypeTransition[] {
  if (states.length < 2) return []
  const transitions: DevicePrototypeTransition[] = []
  for (let index = 0; index < states.length; index += 1) {
    const state = states[index]
    const nextIndex = index + 1
    const previousIndex = index - 1
    if (nextIndex < states.length || settings.loop) {
      const next = states[nextIndex % states.length]
      transitions.push({
        fromStateId: state.id,
        event: settings.nextEvent,
        toStateId: next.id
      })
    }
    if (previousIndex >= 0 || settings.loop) {
      const previous = states[(previousIndex + states.length) % states.length]
      transitions.push({
        fromStateId: state.id,
        event: settings.previousEvent,
        toStateId: previous.id
      })
    }
  }
  return transitions
}

export function resolveDevicePrototypeTransitions(
  interaction: DevicePrototypeInteraction
): DevicePrototypeTransition[] {
  if (interaction.mode === 'manual') {
    return buildManualTransitions(interaction.states, interaction.manual)
  }
  if (interaction.mode === 'slideshow') return []
  return interaction.transitions
}
