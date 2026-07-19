export { default as EmbeddedDisplayPanel } from './components/EmbeddedDisplayPanel.vue'
export { useEmbeddedDisplay } from './composables/useEmbeddedDisplay'
export { createEmbeddedDisplayHttpAdapter } from './adapters/http'

export type {
  EmbeddedFrameBake,
  EmbeddedFrameBakeState,
  EmbeddedPrototypeBake,
  EmbeddedPrototypeBakeResult,
  EmbeddedPrototypeEventId,
  EmbeddedPrototypeOption
} from './model/types'
