import type { EmbeddedImagePayload, EmbeddedWirelessDevice } from '../model/types'

interface WirelessResponse {
  ok?: boolean
  wirelessContent?: boolean
  width?: number
  height?: number
  ip?: string
  apIp?: string
  error?: string
  message?: string
}

const CONTENT_MAGIC = 0x4f504331
const CONTENT_VERSION = 1
const CONTENT_MODE_FRAME = 0

function normalizeBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim().replace(/\/$/, '')
  if (!value) throw new Error('请输入设备地址')
  return value
}

function bytesFromBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
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

export function encodeWirelessImage(payload: EmbeddedImagePayload): ArrayBuffer {
  const pixels = bytesFromBase64(payload.pixelsRgb565Base64)
  const header = new ArrayBuffer(24)
  const view = new DataView(header)
  writeU32(view, 0, CONTENT_MAGIC)
  writeU16(view, 4, CONTENT_VERSION)
  view.setUint8(6, CONTENT_MODE_FRAME)
  view.setUint8(7, 0)
  writeU16(view, 8, payload.width)
  writeU16(view, 10, payload.height)
  writeU16(view, 12, 1)
  writeU16(view, 14, 0)
  writeU32(view, 16, pixels.byteLength)
  writeU32(view, 20, crc32(pixels))

  const body = new Uint8Array(header.byteLength + pixels.byteLength)
  body.set(new Uint8Array(header), 0)
  body.set(pixels, header.byteLength)
  return body.buffer
}

async function parseResponse(response: Response): Promise<WirelessResponse> {
  const text = await response.text()
  let payload: WirelessResponse = {}
  if (text) {
    try {
      payload = JSON.parse(text) as WirelessResponse
    } catch {
      payload = { message: text }
    }
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `设备请求失败（${response.status}）`)
  }
  return payload
}

export async function probeWirelessDevice(baseUrl: string): Promise<EmbeddedWirelessDevice> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/device`, {
    headers: { Accept: 'application/json' }
  })
  const payload = await parseResponse(response)
  if (
    payload.ok !== true ||
    typeof payload.width !== 'number' ||
    typeof payload.height !== 'number' ||
    typeof payload.wirelessContent !== 'boolean'
  ) {
    throw new Error('设备返回了无法识别的状态')
  }
  return {
    ok: payload.ok,
    wirelessContent: payload.wirelessContent,
    width: payload.width,
    height: payload.height,
    ip: payload.ip,
    apIp: payload.apIp
  }
}

export async function uploadWirelessImage(
  baseUrl: string,
  payload: EmbeddedImagePayload,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: encodeWirelessImage(payload),
    signal
  })
  await parseResponse(response)
}
