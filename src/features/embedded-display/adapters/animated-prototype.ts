import type {
  EmbeddedAnimatedPrototypeBakeResult,
  EmbeddedDisplayProfile,
  EmbeddedPrototypeEventId
} from '../model/types'
import { imageFileToRgb565, type EmbeddedImagePlacement } from './image'
import { encodeUsbSequenceFrame } from './usb-sequence'

const CONTENT_MAGIC = 0x4f504331
const CONTENT_VERSION = 1
const CONTENT_MODE_ANIMATED_PROTOTYPE = 3
const CONTENT_HEADER_BYTES = 24
const ANIMATED_HEADER_BYTES = 12
const ANIMATED_STATE_BYTES = 12
const TRANSITION_BYTES = 4
const RESOURCE_BYTES = 12
const MAX_STATES = 10
const CONTENT_CAPACITY_BYTES = 0x1cf0000

const EVENTS: Record<EmbeddedPrototypeEventId, number> = {
  screen_click: 0,
  screen_long_press: 1,
  screen_double_click: 2,
  screen_triple_click: 3,
  boot_click: 4,
  boot_long_press: 5,
  stopwatch_button_a_click: 6,
  stopwatch_button_b_click: 7
}

interface EncodedFrame {
  codec: number
  bytes: Uint8Array
}

export interface UsbAnimatedPrototypePayload {
  profileId: string
  name: string
  width: number
  height: number
  stateCount: number
  frameCount: number
  content: ArrayBuffer
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function orderedFiles(files: File[]): File[] {
  return [...files].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export async function encodeUsbAnimatedPrototype(
  bake: EmbeddedAnimatedPrototypeBakeResult,
  profile: EmbeddedDisplayProfile,
  placement: EmbeddedImagePlacement,
  backgroundColor: string
): Promise<UsbAnimatedPrototypePayload> {
  if (bake.states.length < 1 || bake.states.length > MAX_STATES) {
    throw new Error(`动画交互需要 1 至 ${MAX_STATES} 个状态`)
  }
  const initialStateIndex = bake.states.findIndex((state) => state.id === bake.initialStateId)
  if (initialStateIndex === -1) throw new Error('动画交互缺少有效的初始状态')
  const ids = new Map(bake.states.map((state, index) => [state.id, index]))
  const frames: EncodedFrame[] = []
  const descriptors: Array<{
    firstFrame: number
    frameCount: number
    delay: number
    loop: boolean
  }> = []
  const frameBytes = profile.resolution.width * profile.resolution.height * 2

  for (const state of bake.states) {
    if (!state.files.length) throw new Error(`状态“${state.name}”没有 PNG 帧`)
    const firstFrame = frames.length
    for (const file of orderedFiles(state.files)) {
      if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
        throw new Error(`状态“${state.name}”只支持 PNG 文件`)
      }
      const image = await imageFileToRgb565(file, profile, { placement, backgroundColor })
      const raw = Uint8Array.from(atob(image.pixelsRgb565Base64), (char) => char.charCodeAt(0))
      if (raw.byteLength !== frameBytes) throw new Error(`状态“${state.name}”尺寸不匹配`)
      // Every state starts with a full keyframe. This prevents transitions from
      // depending on a frame belonging to the state that was interrupted.
      frames.push(encodeUsbSequenceFrame(raw))
    }
    descriptors.push({
      firstFrame,
      frameCount: frames.length - firstFrame,
      delay: Math.min(0xffff, Math.max(16, Math.round(state.frameDelayMs))),
      loop: state.loop
    })
  }
  if (frames.length > 0xffff) throw new Error('动画交互帧数超过格式限制')
  if (bake.transitions.length > 0xffff) throw new Error('动画交互跳转数量超过格式限制')

  const dataBytes = frames.reduce((total, frame) => total + frame.bytes.byteLength, 0)
  const payloadBytes =
    ANIMATED_HEADER_BYTES +
    descriptors.length * ANIMATED_STATE_BYTES +
    bake.transitions.length * TRANSITION_BYTES +
    frames.length * RESOURCE_BYTES +
    dataBytes
  const contentBytes = CONTENT_HEADER_BYTES + payloadBytes
  const contentCapacity = profile.wirelessContentBytes ?? CONTENT_CAPACITY_BYTES
  if (contentBytes > contentCapacity) {
    throw new Error(
      `动画交互压缩后为 ${(contentBytes / 1024 / 1024).toFixed(2)} MiB，超过 ${(contentCapacity / 1024 / 1024).toFixed(2)} MiB 内容分区`
    )
  }
  const payload = new Uint8Array(payloadBytes)
  const view = new DataView(payload.buffer)
  view.setUint16(0, initialStateIndex, true)
  view.setUint16(2, descriptors.length, true)
  view.setUint16(4, bake.transitions.length, true)
  view.setUint16(6, frames.length, true)
  view.setUint32(8, frameBytes, true)
  let offset = ANIMATED_HEADER_BYTES
  for (const state of descriptors) {
    view.setUint16(offset, state.firstFrame, true)
    view.setUint16(offset + 2, state.frameCount, true)
    view.setUint16(offset + 4, state.delay, true)
    view.setUint8(offset + 6, state.loop ? 1 : 0)
    offset += ANIMATED_STATE_BYTES
  }
  for (const transition of bake.transitions) {
    const from = ids.get(transition.fromStateId)
    const to = ids.get(transition.toStateId)
    if (from === undefined || to === undefined) throw new Error('动画交互跳转引用了不存在的状态')
    view.setUint8(offset, from)
    view.setUint8(offset + 1, EVENTS[transition.event])
    view.setUint8(offset + 2, to)
    offset += TRANSITION_BYTES
  }
  const dataOffset = offset + frames.length * RESOURCE_BYTES
  let storedOffset = 0
  for (const frame of frames) {
    view.setUint32(offset, storedOffset, true)
    view.setUint32(offset + 4, frame.bytes.byteLength, true)
    view.setUint8(offset + 8, frame.codec)
    payload.set(frame.bytes, dataOffset + storedOffset)
    storedOffset += frame.bytes.byteLength
    offset += RESOURCE_BYTES
  }
  const content = new Uint8Array(contentBytes)
  const envelope = new DataView(content.buffer)
  envelope.setUint32(0, CONTENT_MAGIC, true)
  envelope.setUint16(4, CONTENT_VERSION, true)
  envelope.setUint8(6, CONTENT_MODE_ANIMATED_PROTOTYPE)
  envelope.setUint16(8, profile.resolution.width, true)
  envelope.setUint16(10, profile.resolution.height, true)
  envelope.setUint16(12, frames.length, true)
  envelope.setUint32(16, payload.byteLength, true)
  envelope.setUint32(20, crc32(payload), true)
  content.set(payload, CONTENT_HEADER_BYTES)
  return {
    profileId: profile.id,
    name: bake.name,
    width: profile.resolution.width,
    height: profile.resolution.height,
    stateCount: descriptors.length,
    frameCount: frames.length,
    content: content.buffer
  }
}
