import type { EmbeddedImagePayload, EmbeddedPrototypeEventId, EmbeddedPrototypePayload } from '../model/types'

const CONTENT_MAGIC = 0x4f504331
const CONTENT_VERSION = 1
const CONTENT_MODE_FRAME = 0
const CONTENT_MODE_PROTOTYPE = 1
const CONTENT_HEADER_BYTES = 24
const PROTOTYPE_HEADER_BYTES = 8
const PROTOTYPE_TRANSITION_BYTES = 4
const MAX_PROTOTYPE_STATES = 10

const PROTOTYPE_EVENTS: Record<EmbeddedPrototypeEventId, number> = {
  screen_click: 0,
  screen_long_press: 1,
  screen_double_click: 2,
  screen_triple_click: 3,
  boot_click: 4,
  boot_long_press: 5
}

function bytesFromBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encodeEnvelope(
  mode: number,
  width: number,
  height: number,
  frameCount: number,
  payload: Uint8Array
): ArrayBuffer {
  const body = new Uint8Array(CONTENT_HEADER_BYTES + payload.byteLength)
  const view = new DataView(body.buffer)
  view.setUint32(0, CONTENT_MAGIC, true)
  view.setUint16(4, CONTENT_VERSION, true)
  view.setUint8(6, mode)
  view.setUint8(7, 0)
  view.setUint16(8, width, true)
  view.setUint16(10, height, true)
  view.setUint16(12, frameCount, true)
  view.setUint16(14, 0, true)
  view.setUint32(16, payload.byteLength, true)
  view.setUint32(20, crc32(payload), true)
  body.set(payload, CONTENT_HEADER_BYTES)
  return body.buffer
}

export function encodeWirelessImage(payload: EmbeddedImagePayload): ArrayBuffer {
  const pixels = bytesFromBase64(payload.pixelsRgb565Base64)
  return encodeEnvelope(CONTENT_MODE_FRAME, payload.width, payload.height, 1, pixels)
}

export function encodeWirelessPrototype(payload: EmbeddedPrototypePayload): ArrayBuffer {
  if (payload.states.length < 1 || payload.states.length > MAX_PROTOTYPE_STATES) {
    throw new Error(`BLE 状态机必须包含 1 至 ${MAX_PROTOTYPE_STATES} 个状态`)
  }
  if (payload.transitions.length > 0xffff) throw new Error('BLE 状态机跳转数量过多')
  if (payload.initialStateIndex < 0 || payload.initialStateIndex >= payload.states.length) {
    throw new Error('BLE 状态机缺少有效的初始状态')
  }

  const pixels = bytesFromBase64(payload.pixelsRgb565Base64)
  const frameBytes = payload.width * payload.height * 2
  if (pixels.byteLength !== frameBytes * payload.states.length) {
    throw new Error('BLE 状态机图像数据与状态数量不匹配')
  }

  const metadataBytes = PROTOTYPE_HEADER_BYTES + payload.transitions.length * PROTOTYPE_TRANSITION_BYTES
  const content = new Uint8Array(metadataBytes + pixels.byteLength)
  const view = new DataView(content.buffer)
  view.setUint16(0, payload.initialStateIndex, true)
  view.setUint16(2, payload.transitions.length, true)
  view.setUint32(4, frameBytes, true)

  payload.transitions.forEach((transition, index) => {
    const offset = PROTOTYPE_HEADER_BYTES + index * PROTOTYPE_TRANSITION_BYTES
    view.setUint8(offset, transition.fromStateIndex)
    view.setUint8(offset + 1, PROTOTYPE_EVENTS[transition.event])
    view.setUint8(offset + 2, transition.toStateIndex)
    view.setUint8(offset + 3, 0)
  })
  content.set(pixels, metadataBytes)

  return encodeEnvelope(
    CONTENT_MODE_PROTOTYPE,
    payload.width,
    payload.height,
    payload.states.length,
    content
  )
}