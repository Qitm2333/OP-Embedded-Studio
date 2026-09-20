import profileRegistry from '../../../../tools/embedded-display/screen_profiles/profiles.json'
import type {
  EmbeddedBuildMode,
  EmbeddedDisplayProfile,
  EmbeddedFlashManifest
} from '../model/types'

interface EmbeddedProfileRegistry {
  profiles?: Array<Record<string, unknown>>
  board?: Record<string, unknown>
}

export const DEFAULT_EMBEDDED_DISPLAY_PROFILE_ID = 'co5300_waveshare_amoled_1_75c'

const BUNDLED_FIRMWARE_PROFILES: Partial<Record<EmbeddedBuildMode, ReadonlySet<string>>> = {
  'usb-frame': new Set([
    'co5300_waveshare_amoled_1_75c',
    'co5300_m5stack_stopwatch',
    'ili9342_m5stack_cores3',
    'ssd1315_042_72x40_esp32c3',
    'ssd1315_042_72x40_esp32c3_binary'
  ]),
  'wifi-frame': new Set(['co5300_waveshare_amoled_1_75c', 'co5300_m5stack_stopwatch']),
  'wifi-live': new Set(['co5300_waveshare_amoled_1_75c', 'co5300_m5stack_stopwatch']),
  'ble-frame': new Set([
    'co5300_waveshare_amoled_1_75c',
    'co5300_m5stack_stopwatch',
    'ili9342_m5stack_cores3'
  ])
}

function profileFromRegistry(
  profile: Record<string, unknown>,
  boardFlash?: string
): EmbeddedDisplayProfile {
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
    wirelessContentBytes:
      typeof profile.wirelessContentBytes === 'number' ? profile.wirelessContentBytes : undefined,
    imageOnly: Boolean(profile.imageOnly),
    image: profile.image as EmbeddedDisplayProfile['image'],
    gpio: Array.isArray(profile.wiring)
      ? (profile.wiring as Array<Record<string, unknown>>)
          .map((entry) => ({
            signal: String(entry.signal || ''),
            gpio:
              typeof entry.connectTo === 'string'
                ? entry.connectTo
                : entry.gpio === null || entry.gpio === undefined
                  ? ''
                  : `GPIO${String(entry.gpio)}`,
            pin: entry.fpcPin === undefined ? undefined : `FPC ${String(entry.fpcPin)}`,
            note: typeof entry.note === 'string' ? entry.note : undefined
          }))
          .filter((entry) => entry.signal && entry.gpio)
      : [],
    flashSize: typeof profile.flash === 'string' ? profile.flash : boardFlash,
    source: 'bundled',
    firmwareAvailable: true
  }
}

export function bundledDisplayProfiles(): EmbeddedDisplayProfile[] {
  const registry = profileRegistry as EmbeddedProfileRegistry
  const board = registry.board as Record<string, unknown> | undefined
  const boardFlash = typeof board?.flash === 'string' ? board.flash : undefined
  return (registry.profiles || [])
    .map((profile) => profileFromRegistry(profile, boardFlash))
    .filter(
      (profile) =>
        profile.id &&
        Object.values(BUNDLED_FIRMWARE_PROFILES).some((profileIds) => profileIds?.has(profile.id))
    )
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
