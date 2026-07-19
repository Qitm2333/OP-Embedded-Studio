import type {
  EmbeddedBuildMode,
  EmbeddedBuildResult,
  EmbeddedDisplayAdapter,
  EmbeddedDisplayProfile,
  EmbeddedFlashManifest,
  EmbeddedImagePayload,
  EmbeddedPrototypePayload,
  EmbeddedWifiCredentials
} from '../model/types'

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8765'

interface EmbeddedProfileRegistry {
  profiles?: Array<Record<string, unknown>>
}

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

function profileFromApi(profile: Record<string, unknown>): EmbeddedDisplayProfile {
  const resolution = profile.logicalResolution as { width?: number; height?: number } | undefined
  const visibleArea = profile.visibleArea as EmbeddedDisplayProfile['visibleArea']
  return {
    id: String(profile.id || ''),
    name: String(profile.displayNameZh || profile.displayName || profile.id || '未命名方案'),
    controller: String(profile.controller || '未知'),
    resolution: { width: Number(resolution?.width || 0), height: Number(resolution?.height || 0) },
    interface: String(profile.interface || '4-wire SPI'),
    backgroundColor: '#F5F5F5',
    description: String(
      visibleArea?.descriptionZh || visibleArea?.description || profile.module || ''
    ),
    verified: Boolean(profile.verified),
    defaultsFile: typeof profile.defaultsFile === 'string' ? profile.defaultsFile : undefined,
    visibleArea,
    module: typeof profile.module === 'string' ? profile.module : undefined,
    driverIc: typeof profile.driverIc === 'string' ? profile.driverIc : undefined,
    imageOnly: Boolean(profile.imageOnly),
    image: profile.image as EmbeddedDisplayProfile['image']
  }
}

export function createEmbeddedDisplayHttpAdapter(): EmbeddedDisplayAdapter {
  return {
    async listProfiles() {
      const registry = await requestJson<EmbeddedProfileRegistry>('/api/profiles')
      return (registry.profiles || []).map(profileFromApi).filter((profile) => profile.id)
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
      const modeQuery = buildMode === 'usb-frame' ? '' : `?mode=${encodeURIComponent(buildMode)}`
      return requestJson<EmbeddedFlashManifest>(
        `/api/artifacts/${encodeURIComponent(profileId)}/manifest.json${modeQuery}`
      )
    }
  }
}

export function embeddedArtifactUrl(
  profileId: string,
  path: string,
  buildMode: EmbeddedBuildMode
): string {
  const modeQuery = buildMode === 'usb-frame' ? '' : `?mode=${encodeURIComponent(buildMode)}`
  return `${serverUrl()}/api/artifacts/${encodeURIComponent(profileId)}/${path}${modeQuery}`
}
