import { describe, expect, test } from 'bun:test'

import {
  encodeUsbSequenceFrame,
  encodeUsbSequenceFrames
} from '@/features/embedded-display/adapters/usb-sequence'
import { encodeWirelessImage } from '@/features/embedded-display/adapters/wireless-content'
import {
  encodeBleSequenceFrames,
  encodeWifiSequenceFrames,
  isWirelessSingleImagePayload
} from '@/features/embedded-display/adapters/wireless-sequence'
import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload
} from '@/features/embedded-display/model/types'

const profile = {
  id: 'test-display',
  resolution: { width: 4, height: 1 }
} as EmbeddedDisplayProfile

const patchProfile = {
  id: 'patch-display',
  resolution: { width: 8, height: 8 }
} as EmbeddedDisplayProfile

function singleImagePayload(): EmbeddedImagePayload {
  return {
    profileId: profile.id,
    name: 'single',
    width: 4,
    height: 1,
    frameCount: 1,
    frameDelayMs: 1000,
    pixelsRgb565Base64: Buffer.from(new Uint8Array(8)).toString('base64')
  }
}

function uniqueFrame(seed = 0): Uint8Array {
  const frame = new Uint8Array(8 * 8 * 2)
  for (let pixel = 0; pixel < 64; pixel += 1) {
    frame[pixel * 2] = (pixel + seed) & 0xff
    frame[pixel * 2 + 1] = (pixel * 3 + seed) & 0xff
  }
  return frame
}

describe('USB PNG sequence content', () => {
  test('compresses flat RGB565 frames with RLE16', () => {
    const encoded = encodeUsbSequenceFrame(new Uint8Array(8))
    expect(encoded.codec).toBe(1)
    expect(encoded.bytes).toEqual(new Uint8Array([4, 0, 0, 0]))
  })

  test('allows more than 69 frames when compressed content fits', () => {
    const frames = Array.from({ length: 100 }, () => new Uint8Array(8))
    const sequence = encodeUsbSequenceFrames(profile, frames)
    const view = new DataView(sequence.content)
    expect(sequence.frameCount).toBe(100)
    expect(sequence.compressedFrames).toBe(1)
    expect(sequence.patchFrames).toBe(99)
    expect(view.getUint8(6)).toBe(2)
    expect(view.getUint16(12, true)).toBe(100)
    expect(view.getUint16(30, true)).toBe(100)
  })

  test('encodes every animation frame independently', () => {
    const sequence = encodeUsbSequenceFrames(patchProfile, [uniqueFrame(), uniqueFrame(91)])
    const view = new DataView(sequence.content)
    const secondResourceOffset = 24 + 12 + 12

    expect(sequence.patchFrames).toBe(0)
    expect(sequence.frameDelayMs).toBe(50)
    expect([0, 1]).toContain(view.getUint8(secondResourceOffset + 8))
  })

  test('stores a custom slideshow interval in the existing sequence header', () => {
    const sequence = encodeUsbSequenceFrames(
      patchProfile,
      [uniqueFrame(), uniqueFrame(12)],
      'Slideshow',
      { frameDelayMs: 2500 }
    )
    const view = new DataView(sequence.content)

    expect(sequence.frameDelayMs).toBe(2500)
    expect(view.getUint16(24 + 4, true)).toBe(2500)
  })

  test('encodes a small changed rectangle as a patch', () => {
    const first = uniqueFrame()
    const second = first.slice()
    second[(2 * 8 + 3) * 2] ^= 0xff
    second[(3 * 8 + 4) * 2 + 1] ^= 0xff

    const sequence = encodeUsbSequenceFrames(patchProfile, [first, second])
    const view = new DataView(sequence.content)
    const secondResourceOffset = 24 + 12 + 12
    const sequenceDataOffset = 24 + 12 + 2 * 12
    const firstStoredBytes = view.getUint32(24 + 12 + 4, true)
    const patchOffset = sequenceDataOffset + firstStoredBytes

    expect(sequence.patchFrames).toBe(1)
    expect(view.getUint8(secondResourceOffset + 8)).toBe(2)
    expect(view.getUint16(patchOffset, true)).toBe(3)
    expect(view.getUint16(patchOffset + 2, true)).toBe(2)
    expect(view.getUint16(patchOffset + 4, true)).toBe(2)
    expect(view.getUint16(patchOffset + 6, true)).toBe(2)
  })

  test('keeps the existing single-image format unchanged', () => {
    const encoded = encodeWirelessImage(singleImagePayload())
    const view = new DataView(encoded)
    expect(view.getUint8(6)).toBe(0)
    expect(view.getUint16(12, true)).toBe(1)
  })

  test('accepts converted single images without comparing display names', () => {
    const payload = singleImagePayload()
    payload.name = 'frame-without-extension'

    expect(isWirelessSingleImagePayload(payload, profile.id)).toBe(true)
    expect(isWirelessSingleImagePayload(payload, 'another-display')).toBe(false)
  })

  test('allows Wi-Fi and BLE sequences larger than 5 MiB', () => {
    const largeProfile = {
      id: 'large-wireless-display',
      resolution: { width: 466, height: 466 }
    } as EmbeddedDisplayProfile
    const frame = new Uint8Array(466 * 466 * 2)
    for (let offset = 0; offset < frame.byteLength; offset += 2) {
      frame[offset] = (offset / 2) & 0xff
      frame[offset + 1] = ((offset / 2) >> 8) & 0xff
    }
    const frames = Array.from({ length: 13 }, () => frame)
    const wifi = encodeWifiSequenceFrames(largeProfile, frames)
    const ble = encodeBleSequenceFrames(largeProfile, frames)

    expect(wifi.storedBytes).toBeGreaterThan(5 * 1024 * 1024)
    expect(ble.storedBytes).toBe(wifi.storedBytes)
    expect(wifi.patchFrames).toBe(0)
  })

  test('keeps Wi-Fi and BLE on full frames while USB uses patches', () => {
    const frame = uniqueFrame()
    const frames = [frame, frame.slice()]
    const usb = new Uint8Array(encodeUsbSequenceFrames(patchProfile, frames).content)
    const wifi = new Uint8Array(encodeWifiSequenceFrames(patchProfile, frames).content)
    const ble = new Uint8Array(encodeBleSequenceFrames(patchProfile, frames).content)

    expect(wifi).toEqual(ble)
    expect(wifi).not.toEqual(usb)
    expect(new DataView(wifi.buffer).getUint8(24 + 12 + 12 + 8)).not.toBe(2)
    expect(new DataView(usb.buffer).getUint8(24 + 12 + 12 + 8)).toBe(2)
  })
})
