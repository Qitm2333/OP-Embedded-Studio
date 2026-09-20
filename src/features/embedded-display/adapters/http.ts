import type {
  EmbeddedBuildMode,
  EmbeddedBuildResult,
  EmbeddedDisplayAdapter,
  EmbeddedFlashManifest,
  EmbeddedImagePayload,
  EmbeddedPrototypePayload,
  EmbeddedWifiCredentials
} from '../model/types'
import {
  bundledDisplayProfiles,
  bundledFirmwareManifestUrl,
  fetchFirmwareManifest
} from '../runtime/catalog'

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8765'

function serverUrl(): string {
  const configured = import.meta.env.VITE_EMBEDDED_SERVER_URL as string | undefined
  return (configured || DEFAULT_SERVER_URL).replace(/\/$/, '')
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${serverUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  })
  const payload = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || `设备服务请求失败（${response.status}）`)
  return payload
}

export function createEmbeddedDisplayHttpAdapter(): EmbeddedDisplayAdapter {
  return {
    async listProfiles() {
      return bundledDisplayProfiles()
    },
    async uploadImage(payload: EmbeddedImagePayload) {
      await requestJson('/api/image', { method: 'POST', body: JSON.stringify(payload) })
    },
    async uploadPrototype(payload: EmbeddedPrototypePayload) {
      await requestJson('/api/prototype', { method: 'POST', body: JSON.stringify(payload) })
    },
    async clearImage() {
      await requestJson('/api/image/clear', { method: 'POST' })
    },
    async build(
      profileId: string,
      buildMode: EmbeddedBuildMode,
      wifiCredentials?: EmbeddedWifiCredentials
    ) {
      return requestJson<EmbeddedBuildResult>('/api/build', {
        method: 'POST',
        body: JSON.stringify({ profileId, buildMode, wifiCredentials })
      })
    },
    async getManifest(profileId: string, buildMode: EmbeddedBuildMode) {
      const bundledUrl = bundledFirmwareManifestUrl(profileId, buildMode)
      if (bundledUrl) {
        try {
          return await fetchFirmwareManifest(bundledUrl)
        } catch {
          // Dev servers may not expose packaged firmware assets; use the local
          // device service as a fallback instead of disabling the flash action.
        }
      }
      const modeQuery = buildMode === 'usb-frame' ? '' : `?mode=${encodeURIComponent(buildMode)}`
      return requestJson<EmbeddedFlashManifest>(
        `/api/artifacts/${encodeURIComponent(profileId)}/manifest.json${modeQuery}`
      )
    }
  }
}

export async function prepareWifiFirmwareCredentials(
  profileId: string,
  wifiCredentials?: EmbeddedWifiCredentials,
  buildMode: 'wifi-frame' | 'wifi-live' = 'wifi-frame'
): Promise<string | null> {
  if (!wifiCredentials) return null
  await requestJson('/api/wifi-credentials', {
    method: 'POST',
    body: JSON.stringify({ profileId, wifiCredentials, buildMode })
  })
  return embeddedArtifactUrl(profileId, 'manifest.json', buildMode)
}

export function embeddedManifestUrl(profileId: string, buildMode: EmbeddedBuildMode): string {
  const bundledUrl = bundledFirmwareManifestUrl(profileId, buildMode)
  if (bundledUrl) return bundledUrl
  return embeddedArtifactUrl(profileId, 'manifest.json', buildMode)
}

export function embeddedArtifactUrl(
  profileId: string,
  path: string,
  buildMode: EmbeddedBuildMode
): string {
  const modeQuery = buildMode === 'usb-frame' ? '' : `?mode=${encodeURIComponent(buildMode)}`
  return `${serverUrl()}/api/artifacts/${encodeURIComponent(profileId)}/${path}${modeQuery}`
}
