import type { EmbeddedImagePayload, EmbeddedPrototypePayload } from '../model/types'
import type { UsbAnimatedPrototypePayload } from './animated-prototype'
import { requestSerialPort, type SerialFlashProgress, type SerialPortLike } from './serial-flasher'
import { uploadUsbContent, type UsbContentTransferOptions } from './usb-content-transfer'
import type { UsbImageSequencePayload } from './usb-sequence'
import { encodeWirelessImage, encodeWirelessPrototype } from './wireless-content'

const USB_FAST_PROFILES = new Set([
  'co5300_waveshare_amoled_1_75c',
  'co5300_m5stack_stopwatch',
  'ili9342_m5stack_cores3',
  'ssd1315_042_72x40_esp32c3'
])

export type UsbFlashOptions = UsbContentTransferOptions

export { requestSerialPort as requestUsbSerialPort }
export type { SerialPortLike as UsbSerialPort, SerialFlashProgress as UsbFlashProgress }

export function supportsUsbFrameFastFlash(profileId: string | undefined): boolean {
  return Boolean(profileId && USB_FAST_PROFILES.has(profileId))
}

async function uploadUsbFirmwareContent(
  profileId: string,
  width: number,
  height: number,
  content: Uint8Array,
  options: UsbFlashOptions
): Promise<number> {
  if (!supportsUsbFrameFastFlash(profileId)) {
    throw new Error('当前屏幕尚未提供 USB 高速传输固件')
  }
  return uploadUsbContent({ width, height }, content, options)
}

export async function flashUsbFrameFirmware(
  payload: EmbeddedImagePayload,
  options: UsbFlashOptions = {}
): Promise<number> {
  return uploadUsbFirmwareContent(
    payload.profileId,
    payload.width,
    payload.height,
    new Uint8Array(encodeWirelessImage(payload)),
    options
  )
}

export async function flashUsbSequenceFirmware(
  payload: UsbImageSequencePayload,
  options: UsbFlashOptions = {}
): Promise<number> {
  return uploadUsbFirmwareContent(
    payload.profileId,
    payload.width,
    payload.height,
    new Uint8Array(payload.content),
    options
  )
}

export async function flashUsbAnimatedPrototypeFirmware(
  payload: UsbAnimatedPrototypePayload,
  options: UsbFlashOptions = {}
): Promise<number> {
  return uploadUsbFirmwareContent(
    payload.profileId,
    payload.width,
    payload.height,
    new Uint8Array(payload.content),
    options
  )
}

export async function flashUsbPrototypeFirmware(
  payload: EmbeddedPrototypePayload,
  options: UsbFlashOptions = {}
): Promise<number> {
  return uploadUsbFirmwareContent(
    payload.profileId,
    payload.width,
    payload.height,
    new Uint8Array(encodeWirelessPrototype(payload)),
    options
  )
}
