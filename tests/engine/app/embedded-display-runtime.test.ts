import { describe, expect, test } from 'bun:test'

import { embeddedManifestUrl } from '../../../src/features/embedded-display/adapters/http'
import {
  DEFAULT_EMBEDDED_DISPLAY_PROFILE_ID,
  bundledDisplayProfiles,
  bundledFirmwareManifestUrl
} from '../../../src/features/embedded-display/runtime/catalog'

describe('embedded display runtime catalog', () => {
  test('loads device profiles without the local build service', () => {
    const profiles = bundledDisplayProfiles()
    expect(profiles.map((profile) => profile.id)).toEqual([
      'co5300_waveshare_amoled_1_75c',
      'co5300_m5stack_stopwatch',
      'ili9342_m5stack_cores3',
      'ssd1315_042_72x40_esp32c3',
      'ssd1315_042_72x40_esp32c3_binary'
    ])
    expect(profiles.some((profile) => profile.id === DEFAULT_EMBEDDED_DISPLAY_PROFILE_ID)).toBe(
      true
    )
  })

  test('exposes bundled wireless firmware independently by mode', () => {
    const profileId = 'co5300_waveshare_amoled_1_75c'
    expect(bundledFirmwareManifestUrl(profileId, 'usb-frame')).toContain(
      '/embedded-display/firmware/usb-frame/'
    )
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

    const oledProfileId = 'ssd1315_042_72x40_esp32c3'
    expect(bundledFirmwareManifestUrl(oledProfileId, 'usb-frame')).toContain(
      '/embedded-display/firmware/usb-frame/'
    )
    expect(bundledFirmwareManifestUrl(oledProfileId, 'ble-frame')).toBeNull()

    const binaryOledProfileId = 'ssd1315_042_72x40_esp32c3_binary'
    expect(bundledFirmwareManifestUrl(binaryOledProfileId, 'usb-frame')).toContain(
      '/embedded-display/firmware/usb-frame/'
    )
    expect(bundledFirmwareManifestUrl(binaryOledProfileId, 'ble-frame')).toBeNull()
  })

  test('uses packaged firmware URLs in development without the local build service', () => {
    expect(embeddedManifestUrl('co5300_waveshare_amoled_1_75c', 'usb-frame')).toContain(
      '/embedded-display/firmware/usb-frame/'
    )
    expect(embeddedManifestUrl('ssd1315_042_72x40_esp32c3', 'usb-frame')).toContain(
      '/embedded-display/firmware/usb-frame/'
    )
    expect(embeddedManifestUrl('ssd1315_042_72x40_esp32c3_binary', 'usb-frame')).toContain(
      '/embedded-display/firmware/usb-frame/'
    )
    expect(embeddedManifestUrl('custom_profile', 'usb-frame')).toBe(
      'http://127.0.0.1:8765/api/artifacts/custom_profile/manifest.json'
    )
  })
})
