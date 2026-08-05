export { default as DevicePrototypePanel } from './components/DevicePrototypePanel.vue'
export { default as DevicePrototypePreview } from './components/DevicePrototypePreview.vue'
export { useDevicePrototype } from './composables/useDevicePrototype'
export type { CreateDevicePrototypeInteractionInput } from './composables/useDevicePrototype'
export { DEVICE_PROTOTYPE_EVENTS, DEVICE_PROTOTYPE_MAX_STATES } from './model/types'
export {
  buildManualTransitions,
  DEFAULT_DEVICE_PROTOTYPE_MANUAL_SETTINGS,
  DEFAULT_DEVICE_PROTOTYPE_SLIDESHOW_SETTINGS,
  normalizeSlideshowInterval,
  resolveDevicePrototypeTransitions
} from './model/rules'

export type {
  DevicePrototypeDefinition,
  DevicePrototypeEventId,
  DevicePrototypeFrameCandidate,
  DevicePrototypeFrameRender,
  DevicePrototypeInteraction,
  DevicePrototypeInteractionOption,
  DevicePrototypePreviewProfile,
  DevicePrototypeManualSettings,
  DevicePrototypeMode,
  DevicePrototypeSlideshowSettings,
  DevicePrototypeState,
  DevicePrototypeTransition
} from './model/types'
