import { flashFirmwareManifest } from './manifest-firmware'
import type { SerialFlashProgress, SerialPortLike } from './serial-flasher'
import {
  probeUsbContentDevice,
  type UsbContentSerialPort
} from './usb-content-transfer'

export type UsbContentFirmwareStage = 'checking' | 'flashing' | 'reconnecting' | 'ready'

export interface EnsureUsbContentFirmwareOptions {
  port: UsbContentSerialPort
  manifestUrl: string
  resolution: { width: number; height: number }
  contentBytes: number
  onLog?: (message: string) => void
  onProgress?: (progress: SerialFlashProgress) => void
  onStage?: (stage: UsbContentFirmwareStage, message: string) => void
}

export interface EnsureUsbContentFirmwareResult {
  port: UsbContentSerialPort
  capacity: number
  firmwareUpdated: boolean
}

export interface UsbContentFirmwareDependencies {
  probeDevice: typeof probeUsbContentDevice
  flashManifest: typeof flashFirmwareManifest
  getAuthorizedPort: () => Promise<UsbContentSerialPort | undefined>
  delay: (milliseconds: number) => Promise<void>
  reconnectAttempts: number
  reconnectDelayMs: number
}

interface SerialNavigator {
  getPorts?: () => Promise<UsbContentSerialPort[]>
}

function serialNavigator(): SerialNavigator | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { serial?: SerialNavigator }).serial ?? null
}

export async function getSingleAuthorizedUsbContentPort(): Promise<
  UsbContentSerialPort | undefined
> {
  const authorized = await serialNavigator()?.getPorts?.()
  return authorized?.length === 1 ? authorized[0] : undefined
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

const defaultDependencies: UsbContentFirmwareDependencies = {
  probeDevice: probeUsbContentDevice,
  flashManifest: flashFirmwareManifest,
  getAuthorizedPort: getSingleAuthorizedUsbContentPort,
  delay,
  reconnectAttempts: 20,
  reconnectDelayMs: 750
}

export async function ensureUsbContentFirmware(
  options: EnsureUsbContentFirmwareOptions,
  dependencies: UsbContentFirmwareDependencies = defaultDependencies
): Promise<EnsureUsbContentFirmwareResult> {
  options.onStage?.('checking', '正在检查设备固件与当前内容是否兼容')
  const initialProbe = await dependencies.probeDevice(
    options.port,
    options.resolution,
    options.contentBytes
  )
  if (initialProbe.compatible) {
    options.onStage?.('ready', '设备固件兼容，直接上传内容')
    return {
      port: options.port,
      capacity: initialProbe.capacity,
      firmwareUpdated: false
    }
  }

  if (initialProbe.issue === 'capacity') throw new Error(initialProbe.message)

  options.onLog?.(`设备固件需要自动更新：${initialProbe.message}`)
  options.onStage?.('flashing', '正在自动更新 USB 基础固件')
  await dependencies.flashManifest(options.manifestUrl, 'usb-frame', {
    port: options.port as SerialPortLike,
    onLog: options.onLog,
    onProgress: options.onProgress
  })

  options.onStage?.('reconnecting', '基础固件已更新，正在等待设备重启并恢复连接')
  let lastError: unknown
  for (let attempt = 0; attempt < dependencies.reconnectAttempts; attempt += 1) {
    if (attempt > 0) await dependencies.delay(dependencies.reconnectDelayMs)
    try {
      const port = (await dependencies.getAuthorizedPort()) ?? options.port
      const probe = await dependencies.probeDevice(port, options.resolution, options.contentBytes)
      if (probe.compatible) {
        options.onStage?.('ready', '设备已恢复连接，继续上传内容')
        return { port, capacity: probe.capacity, firmwareUpdated: true }
      }
      lastError = new Error(probe.message)
      if (probe.issue === 'capacity') break
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('USB 基础固件更新后未能重新连接设备')
}
