import profileRegistry from '../../../../tools/embedded-display/screen_profiles/profiles.json'
import type {
  EmbeddedBuildMode,
  EmbeddedDisplayProfile,
  EmbeddedFlashManifest
} from '../model/types'

interface EmbeddedProfileRegistry {
  profiles?: Array<Record<string, unknown>>
}

export const DEFAULT_EMBEDDED_DISPLAY_PROFILE_ID = 'co5300_waveshare_amoled_1_75c'

const BUNDLED_FIRMWARE_PROFILES: Partial<Record<EmbeddedBuildMode, ReadonlySet<string>>> = {
  'usb-frame': new Set(['co5300_waveshare_amoled_1_75c']),
  'wifi-frame': new Set(['co5300_waveshare_amoled_1_75c']),
  'wifi-live': new Set(['co5300_waveshare_amoled_1_75c']),
  'ble-frame': new Set(['co5300_waveshare_amoled_1_75c'])
}

function profileFromRegistry(profile: Record<string, unknown>): EmbeddedDisplayProfile {
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

export function bundledDisplayProfiles(): EmbeddedDisplayProfile[] {
  const registry = profileRegistry as EmbeddedProfileRegistry
  return (registry.profiles || []).map(profileFromRegistry).filter((profile) => profile.id)
}

export function bundledFirmwareManifestUrl(
  profileId: string,
  buildMode: EmbeddedBuildMode
): string | null {
  if (!BUNDLED_FIRMWARE_PROFILES[buildMode]?.has(profileId)) return null
  const configuredBaseUrl = import.meta.env.BASE_URL || '/'
  const baseUrl = configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`
  return `${baseUrl}embedded-display/firmware/${buildMode}/${encodeURIComponent(profileId)}/manifest.json`
}

export async function fetchFirmwareManifest(url: string): Promise<EmbeddedFlashManifest> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`无法读取固件清单（${response.status}）`)
  return (await response.json()) as EmbeddedFlashManifest
}
