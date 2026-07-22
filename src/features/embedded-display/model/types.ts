export interface EmbeddedDisplayProfile {
  id: string
  name: string
  controller: 'ST7789' | 'ST7735' | 'GC9D01N' | string
  resolution: { width: number; height: number }
  interface: string
  backgroundColor: string
  description: string
  verified: boolean
  defaultsFile?: string
  visibleArea?: { shape?: string; description?: string; descriptionZh?: string }
  module?: string
  driverIc?: string
  imageOnly?: boolean
  image?: {
    pixelFormat: 'RGB565' | string
    colorOrder: 'RGB' | 'BGR' | string
    byteOrder: 'little' | 'big' | string
    rotation: 0 | 90 | 180 | 270 | number
    xGap: number
    yGap: number
    transport: string
  }
}

export interface EmbeddedFrameBakeState {
  id: string
  revision: number
  available: boolean
  name: string
  width: number
  height: number
  reason?: string
}

export type EmbeddedFrameBake = () => Promise<File | null>
export type EmbeddedFrameBakeById = (frameId: string) => Promise<File | null>

export interface EmbeddedPrototypeOption {
  id: string
  name: string
  stateCount: number
  initialStateName: string
  width: number
  height: number
  valid: boolean
  reason?: string
}

export type EmbeddedPrototypeEventId =
  | 'screen_click'
  | 'screen_long_press'
  | 'screen_double_click'
  | 'screen_triple_click'
  | 'boot_click'
  | 'boot_long_press'

export interface EmbeddedPrototypeBakeResult {
  id: string
  name: string
  initialStateId: string
  states: Array<{
    id: string
    name: string
    file: File
  }>
  transitions: Array<{
    fromStateId: string
    event: EmbeddedPrototypeEventId
    toStateId: string
  }>
}

export type EmbeddedPrototypeBake = (
  interactionId: string
) => Promise<EmbeddedPrototypeBakeResult | null>

export interface EmbeddedPrototypePayload {
  profileId: string
  name: string
  width: number
  height: number
  initialStateIndex: number
  states: Array<{ id: string; name: string }>
  transitions: Array<{
    fromStateIndex: number
    event: EmbeddedPrototypeEventId
    toStateIndex: number
  }>
  pixelsRgb565Base64: string
}

export interface EmbeddedDisplayVariable {
  name: string
  value: string
  type: 'color' | 'number' | 'text'
}

export interface EmbeddedImagePayload {
  profileId: string
  name: string
  width: number
  height: number
  frameCount: number
  frameDelayMs: number
  pixelsRgb565Base64: string
}

export interface EmbeddedWirelessDevice {
  ok: boolean
  wirelessContent: boolean
  width: number
  height: number
  connected?: boolean
  ip?: string
  apIp?: string
  livePreview?: boolean
}

export interface EmbeddedWifiCredentials {
  ssid: string
  password: string
}

export type EmbeddedBuildMode =
  | 'usb-frame'
  | 'usb-prototype'
  | 'wifi-frame'
  | 'wifi-prototype'
  | 'wifi-live'
  | 'lan-frame'
  | 'lan-prototype'
  | 'ble-frame'
  | 'ble-prototype'

export interface EmbeddedBuildResult {
  profileId: string
  buildMode?: EmbeddedBuildMode
  ok: boolean
  cached?: boolean
  returnCode?: number
  command?: string[]
  artifacts?: Record<string, string>
  size?: { appBytes: number; appPartitionBytes: number; appFreeBytes: number }
  logTail?: string[]
  error?: string
}

export interface EmbeddedFlashManifest {
  name: string
  version: string
  new_install_prompt_erase?: boolean
  builds: Array<{
    chipFamily: string
    parts: Array<{ path: string; offset: number }>
  }>
}

export interface EmbeddedDisplayAdapter {
  listProfiles(): Promise<EmbeddedDisplayProfile[]>
  uploadImage(payload: EmbeddedImagePayload): Promise<void>
  uploadPrototype(payload: EmbeddedPrototypePayload): Promise<void>
  clearImage(): Promise<void>
  build(
    profileId: string,
    buildMode: EmbeddedBuildMode,
    wifiCredentials?: EmbeddedWifiCredentials
  ): Promise<EmbeddedBuildResult>
  getManifest(profileId: string, buildMode: EmbeddedBuildMode): Promise<EmbeddedFlashManifest>
}

export type EmbeddedBuildStatus = 'loading' | 'idle' | 'uploading' | 'building' | 'ready' | 'error'
