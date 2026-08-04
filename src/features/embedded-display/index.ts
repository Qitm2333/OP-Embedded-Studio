export { default as EmbeddedDisplayPanel } from './components/EmbeddedDisplayPanel.vue'
export {
  getActiveEmbeddedDisplayProfile,
  useEmbeddedDisplay
} from './composables/useEmbeddedDisplay'
export { createEmbeddedDisplayHttpAdapter } from './adapters/http'
export {
  cancelUsbFrameDeployment,
  executeUsbFrameDeployment,
  getUsbFrameDeploymentPlan,
  isUsbFrameDeploymentBusy,
  normalizeUsbDeploymentError,
  prepareUsbFrameDeployment,
  prepareUsbPrototypeDeployment,
  supersedeUsbFrameDeployment
} from './deployment/usb-frame'

export type {
  EmbeddedDisplayProfile,
  EmbeddedFrameBake,
  EmbeddedFrameBakeById,
  EmbeddedFrameBakeState,
  EmbeddedPrototypeBake,
  EmbeddedPrototypeBakeResult,
  EmbeddedPrototypeEventId,
  EmbeddedPrototypeOption
} from './model/types'

export type {
  ExecuteUsbFrameDeploymentOptions,
  PrepareUsbFrameDeploymentInput,
  PrepareUsbPrototypeDeploymentInput,
  UsbFrameDeploymentFrame,
  UsbFrameDeploymentPlan,
  UsbFrameDeploymentStageStatus,
  UsbFrameDeploymentStatus
} from './deployment/usb-frame'
