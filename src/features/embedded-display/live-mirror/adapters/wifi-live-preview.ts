import { encodeWirelessImage } from '@/features/embedded-display/adapters/wireless-content'
import type {
  EmbeddedImagePayload,
  EmbeddedWirelessDevice
} from '@/features/embedded-display/model/types'

interface LivePreviewDeviceResponse {
  ok?: boolean
  wirelessContent?: boolean
  livePreview?: boolean
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

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('设备响应超时，请确认实时镜像固件仍在运行')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

async function parseResponse(response: Response): Promise<LivePreviewDeviceResponse> {
  const text = await response.text()
  let payload: LivePreviewDeviceResponse = {}
  if (text) {
    try {
      payload = JSON.parse(text) as LivePreviewDeviceResponse
    } catch {
      payload = { message: text }
    }
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `设备请求失败（${response.status}）`)
  }
  return payload
}

export async function probeWifiLivePreviewDevice(baseUrl: string): Promise<EmbeddedWirelessDevice> {
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(baseUrl)}/api/device`,
    {
      headers: { Accept: 'application/json' }
    },
    5000
  )
  const payload = await parseResponse(response)
  if (
    payload.ok !== true ||
    payload.livePreview !== true ||
    typeof payload.width !== 'number' ||
    typeof payload.height !== 'number'
  ) {
    throw new Error('当前设备固件不支持 Wi-Fi 实时镜像，请先通过 USB 重新初始化')
  }
  return {
    ok: true,
    wirelessContent: payload.wirelessContent === true,
    livePreview: true,
    width: payload.width,
    height: payload.height,
    connected: payload.connected,
    ip: payload.ip,
    apIp: payload.apIp
  }
}

export async function uploadWifiLivePreviewFrame(
  baseUrl: string,
  payload: EmbeddedImagePayload
): Promise<void> {
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(baseUrl)}/api/preview/frame`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: encodeWirelessImage(payload)
    },
    30000
  )
  await parseResponse(response)
}

export async function stopWifiLivePreview(baseUrl: string): Promise<void> {
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(baseUrl)}/api/preview/stop`,
    {
      method: 'POST'
    },
    10000
  )
  await parseResponse(response)
}
