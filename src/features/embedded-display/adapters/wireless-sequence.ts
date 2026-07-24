import type { EmbeddedDisplayProfile } from '../model/types'
import {
  encodeUsbSequenceFrames,
  imageFilesToUsbSequence,
  type UsbImageSequencePayload
} from './usb-sequence'

const WIFI_SEQUENCE_CONTENT_BYTES = 0x4f0000
const BLE_SEQUENCE_CONTENT_BYTES = 5 * 1024 * 1024

export type WirelessImageSequencePayload = UsbImageSequencePayload

function ensureWirelessSequenceFits(
  payload: UsbImageSequencePayload,
  maxContentBytes: number
): WirelessImageSequencePayload {
  if (payload.storedBytes > maxContentBytes) {
    throw new Error(
      `PNG 序列压缩后为 ${(payload.storedBytes / 1024 / 1024).toFixed(2)} MiB，超过 ${(maxContentBytes / 1024 / 1024).toFixed(2)} MiB 无线传输上限`
    )
  }
  return payload
}

export function encodeWifiSequenceFrames(
  profile: EmbeddedDisplayProfile,
  frames: Uint8Array[],
  name = 'PNG sequence'
): WirelessImageSequencePayload {
  return ensureWirelessSequenceFits(
    encodeUsbSequenceFrames(profile, frames, name),
    WIFI_SEQUENCE_CONTENT_BYTES
  )
}

export function encodeBleSequenceFrames(
  profile: EmbeddedDisplayProfile,
  frames: Uint8Array[],
  name = 'PNG sequence'
): WirelessImageSequencePayload {
  return ensureWirelessSequenceFits(
    encodeUsbSequenceFrames(profile, frames, name),
    BLE_SEQUENCE_CONTENT_BYTES
  )
}

export async function imageFilesToWifiSequence(
  files: File[],
  profile: EmbeddedDisplayProfile
): Promise<WirelessImageSequencePayload> {
  return ensureWirelessSequenceFits(
    await imageFilesToUsbSequence(files, profile),
    WIFI_SEQUENCE_CONTENT_BYTES
  )
}

export async function imageFilesToBleSequence(
  files: File[],
  profile: EmbeddedDisplayProfile
): Promise<WirelessImageSequencePayload> {
  return ensureWirelessSequenceFits(
    await imageFilesToUsbSequence(files, profile),
    BLE_SEQUENCE_CONTENT_BYTES
  )
}
