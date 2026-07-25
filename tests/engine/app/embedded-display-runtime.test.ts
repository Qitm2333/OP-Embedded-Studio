import { describe, expect, test } from 'bun:test'

import {
  bundledDisplayProfiles,
  bundledFirmwareManifestUrl
} from '../../../src/features/embedded-display/runtime/catalog'

describe('embedded display runtime catalog', () => {
  test('loads device profiles without the local build service', () => {
    const profiles = bundledDisplayProfiles()
    expect(profiles).toHaveLength(4)
    expect(profiles.some((profile) => profile.id === 'co5300_waveshare_amoled_1_75c')).toBe(true)
  })

  test('exposes bundled wireless firmware independently by mode', () => {
    const profileId = 'co5300_waveshare_amoled_1_75c'
    expect(bundledFirmwareManifestUrl(profileId, 'wifi-frame')).toContain(
      '/embedded-display/firmware/wifi-frame/'
    )
    expect(bundledFirmwareManifestUrl(profileId, 'wifi-live')).toContain(
      '/embedded-display/firmware/wifi-live/'
    )
    expect(bundledFirmwareManifestUrl(profileId, 'ble-frame')).toContain(
      '/embedded-display/firmware/ble-frame/'
    )
    expect(bundledFirmwareManifestUrl(profileId, 'usb-prototype')).toBeNull()
  })
})
