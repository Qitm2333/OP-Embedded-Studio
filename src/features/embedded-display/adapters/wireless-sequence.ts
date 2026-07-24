import type { EmbeddedDisplayProfile } from '../model/types'
import {
  encodeUsbSequenceFrames,
  imageFilesToUsbSequence,
  type UsbImageSequencePayload
} from './usb-sequence'

const WIRELESS_SEQUENCE_CONTENT_BYTES = 0x1cf0000

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
    WIRELESS_SEQUENCE_CONTENT_BYTES
  )
}

export function encodeBleSequenceFrames(
  profile: EmbeddedDisplayProfile,
  frames: Uint8Array[],
  name = 'PNG sequence'
): WirelessImageSequencePayload {
  return ensureWirelessSequenceFits(
    encodeUsbSequenceFrames(profile, frames, name),
    WIRELESS_SEQUENCE_CONTENT_BYTES
  )
}

export async function imageFilesToWifiSequence(
  files: File[],
  profile: EmbeddedDisplayProfile
): Promise<WirelessImageSequencePayload> {
  return ensureWirelessSequenceFits(
    await imageFilesToUsbSequence(files, profile),
    WIRELESS_SEQUENCE_CONTENT_BYTES
  )
}

export async function imageFilesToBleSequence(
  files: File[],
  profile: EmbeddedDisplayProfile
): Promise<WirelessImageSequencePayload> {
  return ensureWirelessSequenceFits(
    await imageFilesToUsbSequence(files, profile),
    WIRELESS_SEQUENCE_CONTENT_BYTES
  )
}
