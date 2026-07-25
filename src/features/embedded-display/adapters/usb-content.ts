import type { EmbeddedImagePayload, EmbeddedPrototypePayload } from '../model/types'
import {
  fetchSerialFirmwarePart,
  flashSerialFirmware,
  requestSerialPort,
  type SerialFlashOptions
} from './serial-flasher'
import type { UsbImageSequencePayload } from './usb-sequence'
import { encodeWirelessImage, encodeWirelessPrototype } from './wireless-content'

const USB_CONTENT_OFFSET = 0x310000
const USB_CONTENT_BYTES = 0x1cf0000
const USB_FAST_PROFILES = new Set(['co5300_waveshare_amoled_1_75c'])

export { requestSerialPort as requestUsbSerialPort }
export type {
  SerialFlashOptions as UsbFlashOptions,
  SerialPortLike as UsbSerialPort,
  SerialFlashProgress as UsbFlashProgress
} from './serial-flasher'

export function supportsUsbFrameFastFlash(profileId: string | undefined): boolean {
  return Boolean(profileId && USB_FAST_PROFILES.has(profileId))
}

async function loadUsbFirmware(profileId: string, content: Uint8Array) {
  const configuredBaseUrl = import.meta.env.BASE_URL || '/'
  const appBaseUrl = configuredBaseUrl.endsWith('/') ? configuredBaseUrl : `${configuredBaseUrl}/`
  const baseUrl = `${appBaseUrl}embedded-display/firmware/usb-frame/${encodeURIComponent(profileId)}`
  const stableParts = await Promise.all([
    fetchSerialFirmwarePart(`${baseUrl}/bootloader.bin`, 0x0000),
    fetchSerialFirmwarePart(`${baseUrl}/partition-table.bin`, 0x8000),
    fetchSerialFirmwarePart(`${baseUrl}/app.bin`, 0x10000)
  ])
  return [...stableParts, { address: USB_CONTENT_OFFSET, data: content }]
}

async function flashUsbFirmware(
  profileId: string,
  content: Uint8Array,
  options: Omit<SerialFlashOptions, 'flashSize'>
): Promise<void> {
  if (!supportsUsbFrameFastFlash(profileId)) {
    throw new Error('当前屏幕尚未提供 USB 预编译固件')
  }
  if (content.byteLength > USB_CONTENT_BYTES) {
    throw new Error('内容超过 USB 内容分区容量')
  }

  const firmwareParts = await loadUsbFirmware(profileId, content)
  await flashSerialFirmware(firmwareParts, {
    ...options,
    flashSize: '32MB',
    preparingMessage: '正在准备预编译固件和内容…',
    connectedMessage: '已连接，正在一次性写入预编译固件和内容。'
  })
}

export async function flashUsbFrameFirmware(
  payload: EmbeddedImagePayload,
  options: Omit<SerialFlashOptions, 'flashSize'> = {}
): Promise<void> {
  await flashUsbFirmware(payload.profileId, new Uint8Array(encodeWirelessImage(payload)), options)
}

export async function flashUsbSequenceFirmware(
  payload: UsbImageSequencePayload,
  options: Omit<SerialFlashOptions, 'flashSize'> = {}
): Promise<void> {
  await flashUsbFirmware(payload.profileId, new Uint8Array(payload.content), options)
}

export async function flashUsbPrototypeFirmware(
  payload: EmbeddedPrototypePayload,
  options: Omit<SerialFlashOptions, 'flashSize'> = {}
): Promise<void> {
  await flashUsbFirmware(
    payload.profileId,
    new Uint8Array(encodeWirelessPrototype(payload)),
    options
  )
}
