import type { FlashSizeValues } from 'esptool-js'

import type { EmbeddedBuildMode, EmbeddedFlashManifest } from '../model/types'
import {
  fetchSerialFirmwarePart,
  flashSerialFirmware,
  type SerialFirmwarePart,
  type SerialFlashOptions
} from './serial-flasher'

const WIRELESS_FLASH_SIZE: Partial<Record<EmbeddedBuildMode, FlashSizeValues>> = {
  'usb-frame': '32MB',
  'wifi-frame': '32MB',
  'wifi-live': '8MB',
  'ble-frame': '32MB'
}

function resolveArtifactUrl(path: string, manifestUrl: string): string {
  const manifestAbsoluteUrl = new URL(manifestUrl, window.location.href)
  return new URL(path, manifestAbsoluteUrl).toString()
}

export async function loadFirmwareManifestParts(
  manifestUrl: string,
  onLog?: (message: string) => void
): Promise<SerialFirmwarePart[]> {
  const response = await fetch(manifestUrl, {
    cache: 'no-store',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`无法读取固件清单：${response.status}`)
  const manifest = (await response.json()) as EmbeddedFlashManifest
  const build = manifest.builds.find((candidate) => candidate.chipFamily === 'ESP32-S3')
  if (!build?.parts.length) throw new Error('固件清单中缺少 ESP32-S3 分区')

  onLog?.(`正在下载 ${build.parts.length} 个固件分区…`)
  return Promise.all(
    build.parts.map((part) =>
      fetchSerialFirmwarePart(resolveArtifactUrl(part.path, manifestUrl), part.offset)
    )
  )
}

export async function flashFirmwareManifest(
  manifestUrl: string,
  buildMode: 'usb-frame' | 'wifi-frame' | 'wifi-live' | 'ble-frame',
  options: Omit<SerialFlashOptions, 'flashSize'> = {}
): Promise<void> {
  const parts = await loadFirmwareManifestParts(manifestUrl, options.onLog)
  await flashSerialFirmware(parts, {
    ...options,
    flashSize: WIRELESS_FLASH_SIZE[buildMode] ?? 'detect',
    eraseAll: options.eraseAll ?? true
  })
}
