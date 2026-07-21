import { ESPLoader, Transport } from 'esptool-js'

import type { EmbeddedImagePayload, EmbeddedPrototypePayload } from '../model/types'
import { encodeWirelessImage, encodeWirelessPrototype } from './wireless-content'

const USB_CONTENT_OFFSET = 0x310000
const USB_CONTENT_BYTES = 0x4f0000
const USB_BAUD_RATE = 921600
const USB_FAST_PROFILES = new Set(['co5300_waveshare_amoled_1_75c'])

interface UsbFirmwarePart {
  address: number
  data: Uint8Array
}

export interface UsbFlashProgress {
  written: number
  total: number
  percent: number
}

export interface UsbFlashOptions {
  onLog?: (message: string) => void
  onProgress?: (progress: UsbFlashProgress) => void
}

export function supportsUsbFrameFastFlash(profileId: string | undefined): boolean {
  return Boolean(profileId && USB_FAST_PROFILES.has(profileId))
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

async function resetUsbDevice(transport: Transport, loader: ESPLoader): Promise<void> {
  // esptool-js hard_reset only releases RTS. Assert reset first, matching
  // esp-web-tools and the ESP32-S3 USB Serial/JTAG hardware sequence.
  await transport.setDTR(false)
  await transport.setRTS(true)
  await delay(120)
  await loader.after('hard_reset')
  await delay(300)
}

async function fetchFirmwarePart(path: string, address: number): Promise<UsbFirmwarePart> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`无法读取预编译固件：${response.status}`)
  return { address, data: new Uint8Array(await response.arrayBuffer()) }
}

async function loadUsbFirmware(profileId: string, content: Uint8Array): Promise<UsbFirmwarePart[]> {
  // Frame and prototype share one precompiled USB runtime. The content envelope
  // selects static-image or state-machine behavior after boot.
  const baseUrl = `/embedded-display/firmware/usb-frame/${profileId}`
  const stableParts = await Promise.all([
    fetchFirmwarePart(`${baseUrl}/bootloader.bin`, 0x0000),
    fetchFirmwarePart(`${baseUrl}/partition-table.bin`, 0x8000),
    fetchFirmwarePart(`${baseUrl}/app.bin`, 0x10000)
  ])
  return [...stableParts, { address: USB_CONTENT_OFFSET, data: content }]
}

async function flashUsbFirmware(
  profileId: string,
  content: Uint8Array,
  options: UsbFlashOptions
): Promise<void> {
  if (!supportsUsbFrameFastFlash(profileId)) {
    throw new Error('当前屏幕尚未提供 USB 预编译固件')
  }
  if (content.byteLength > USB_CONTENT_BYTES) {
    throw new Error('内容超过 USB 内容分区容量')
  }
  const serial = (
    navigator as Navigator & {
      serial?: { requestPort: () => Promise<ConstructorParameters<typeof Transport>[0]> }
    }
  ).serial
  if (!serial) {
    throw new Error('当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge')
  }

  options.onLog?.('正在准备预编译固件和内容…')
  const firmwareParts = await loadUsbFirmware(profileId, content)
  const totalBytes = firmwareParts.reduce((sum, part) => sum + part.data.byteLength, 0)
  const completedBytes = firmwareParts.map((_, index) =>
    firmwareParts.slice(0, index).reduce((sum, part) => sum + part.data.byteLength, 0)
  )

  const port = await serial.requestPort()
  const transport = new Transport(port, false)
  const loader = new ESPLoader({
    transport,
    baudrate: USB_BAUD_RATE,
    terminal: {
      clean: () => undefined,
      write: (message) => options.onLog?.(message),
      writeLine: (message) => options.onLog?.(message)
    }
  })

  try {
    options.onLog?.('正在连接 ESP32-S3…')
    await loader.main()
    options.onLog?.('已连接，正在一次性写入预编译固件和内容。')
    await loader.writeFlash({
      fileArray: firmwareParts,
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: '8MB',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written) => {
        const aggregateWritten = completedBytes[fileIndex] + written
        options.onProgress?.({
          written: aggregateWritten,
          total: totalBytes,
          percent: Math.round((aggregateWritten / totalBytes) * 100)
        })
      }
    })
    options.onLog?.('写入完成，正在重启设备。')
    await resetUsbDevice(transport, loader)
  } finally {
    try {
      await transport.disconnect()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      options.onLog?.(`串口已随设备重启释放：${message}`)
    }
  }
}

export async function flashUsbFrameFirmware(
  payload: EmbeddedImagePayload,
  options: UsbFlashOptions = {}
): Promise<void> {
  await flashUsbFirmware(payload.profileId, new Uint8Array(encodeWirelessImage(payload)), options)
}

export async function flashUsbPrototypeFirmware(
  payload: EmbeddedPrototypePayload,
  options: UsbFlashOptions = {}
): Promise<void> {
  await flashUsbFirmware(
    payload.profileId,
    new Uint8Array(encodeWirelessPrototype(payload)),
    options
  )
}
