import { flashFirmwareManifest } from './manifest-firmware'
import type { SerialFlashProgress, SerialPortLike } from './serial-flasher'
import {
  UsbContentDeviceUnavailableError,
  UsbContentFirmwareError,
  type UsbContentSerialPort
} from './usb-content-transfer'

export type UsbContentFirmwareStage =
  | 'checking'
  | 'flashing'
  | 'reconnecting'
  | 'transferring'
  | 'ready'

export interface TransferUsbContentWithFirmwareFallbackOptions {
  port: UsbContentSerialPort
  manifestUrl: string
  transfer: (port: UsbContentSerialPort, firmwareUpdated: boolean) => Promise<number>
  onLog?: (message: string) => void
  onProgress?: (progress: SerialFlashProgress) => void
  onStage?: (stage: UsbContentFirmwareStage, message: string) => void
}

export interface TransferUsbContentWithFirmwareFallbackResult {
  port: UsbContentSerialPort
  capacity: number
  firmwareUpdated: boolean
}

export interface UsbContentFirmwareDependencies {
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
  flashManifest: flashFirmwareManifest,
  getAuthorizedPort: getSingleAuthorizedUsbContentPort,
  delay,
  reconnectAttempts: 20,
  reconnectDelayMs: 750
}

function recoverableFirmwareError(error: unknown): UsbContentFirmwareError | null {
  if (!(error instanceof UsbContentFirmwareError)) return null
  return error.issue === 'capacity' ? null : error
}

function retryableReconnectError(error: unknown): boolean {
  return (
    error instanceof UsbContentDeviceUnavailableError || Boolean(recoverableFirmwareError(error))
  )
}

export async function transferUsbContentWithFirmwareFallback(
  options: TransferUsbContentWithFirmwareFallbackOptions,
  dependencies: UsbContentFirmwareDependencies = defaultDependencies
): Promise<TransferUsbContentWithFirmwareFallbackResult> {
  options.onStage?.('checking', '正在连接设备并检查固件兼容性')
  try {
    options.onStage?.('transferring', '设备固件兼容，正在上传内容')
    const capacity = await options.transfer(options.port, false)
    options.onStage?.('ready', '内容上传完成')
    return {
      port: options.port,
      capacity,
      firmwareUpdated: false
    }
  } catch (error) {
    const firmwareError = recoverableFirmwareError(error)
    if (!firmwareError) throw error
    options.onLog?.(`设备固件需要自动更新：${firmwareError.message}`)
  }

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
    const port = (await dependencies.getAuthorizedPort()) ?? options.port
    try {
      options.onStage?.('transferring', '设备已恢复连接，正在上传内容')
      const capacity = await options.transfer(port, true)
      options.onStage?.('ready', '固件与内容已更新完成')
      return { port, capacity, firmwareUpdated: true }
    } catch (error) {
      if (!retryableReconnectError(error)) throw error
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('USB 基础固件更新后未能重新连接设备')
}
