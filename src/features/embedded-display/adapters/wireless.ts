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

export interface WirelessUploadProgress {
  percent: number
  written: number
  total: number
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
  signal?: AbortSignal,
  onProgress?: (progress: WirelessUploadProgress) => void
): Promise<void> {
  if (onProgress) {
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest()
      const abortRequest = () => request.abort()
      const cleanup = () => signal?.removeEventListener('abort', abortRequest)

      request.open('POST', `${normalizeBaseUrl(baseUrl)}/api/content`)
      request.setRequestHeader('Content-Type', 'application/octet-stream')
      request.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable || event.total <= 0) return
        onProgress({
          percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
          written: event.loaded,
          total: event.total
        })
      })
      request.addEventListener('load', () => {
        cleanup()
        void parseResponse(
          new Response(request.responseText, {
            status: request.status,
            statusText: request.statusText
          })
        ).then(() => resolve(), reject)
      })
      request.addEventListener('error', () => {
        cleanup()
        reject(new Error('Wi-Fi 内容传输失败'))
      })
      request.addEventListener('abort', () => {
        cleanup()
        reject(new DOMException('Wi-Fi 内容传输已取消', 'AbortError'))
      })
      signal?.addEventListener('abort', abortRequest, { once: true })
      request.send(body)
    })
    return
  }

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
  signal?: AbortSignal,
  onProgress?: (progress: WirelessUploadProgress) => void
): Promise<void> {
  await uploadWirelessContent(baseUrl, encodeWirelessImage(payload), signal, onProgress)
}

export async function uploadWirelessPrototype(
  baseUrl: string,
  payload: EmbeddedPrototypePayload,
  signal?: AbortSignal,
  onProgress?: (progress: WirelessUploadProgress) => void
): Promise<void> {
  await uploadWirelessContent(baseUrl, encodeWirelessPrototype(payload), signal, onProgress)
}

export async function uploadWirelessSequence(
  baseUrl: string,
  payload: WirelessImageSequencePayload,
  signal?: AbortSignal,
  onProgress?: (progress: WirelessUploadProgress) => void
): Promise<void> {
  await uploadWirelessContent(baseUrl, payload.content, signal, onProgress)
}
