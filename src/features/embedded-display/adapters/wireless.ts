import type {
  EmbeddedImagePayload,
  EmbeddedPrototypePayload,
  EmbeddedWirelessDevice
} from '../model/types'
import { encodeWirelessImage, encodeWirelessPrototype } from './wireless-content'
import type { WirelessImageSequencePayload } from './wireless-sequence'

interface WirelessResponse {
  ok?: boolean
  wirelessContent?: boolean
  width?: number
  height?: number
  connected?: boolean
  ip?: string
  apIp?: string
  error?: string
  message?: string
}

function normalizeBaseUrl(baseUrl: string): string {
  const value = baseUrl.trim().replace(/\/$/, '')
  if (!value) throw new Error('请输入设备地址')
  return value
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
    connected: payload.connected,
    ip: payload.ip,
    apIp: payload.apIp
  }
}

async function uploadWirelessContent(
  baseUrl: string,
  body: ArrayBuffer,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
    signal
  })
  await parseResponse(response)
}

export async function uploadWirelessImage(
  baseUrl: string,
  payload: EmbeddedImagePayload,
  signal?: AbortSignal
): Promise<void> {
  await uploadWirelessContent(baseUrl, encodeWirelessImage(payload), signal)
}

export async function uploadWirelessPrototype(
  baseUrl: string,
  payload: EmbeddedPrototypePayload,
  signal?: AbortSignal
): Promise<void> {
  await uploadWirelessContent(baseUrl, encodeWirelessPrototype(payload), signal)
}

export async function uploadWirelessSequence(
  baseUrl: string,
  payload: WirelessImageSequencePayload,
  signal?: AbortSignal
): Promise<void> {
  await uploadWirelessContent(baseUrl, payload.content, signal)
}
