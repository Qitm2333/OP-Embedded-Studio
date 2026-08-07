import { flashFirmwareManifest } from './manifest-firmware'
import type { SerialFlashProgress, SerialPortLike } from './serial-flasher'
import {
  UsbContentDeviceUnavailableError,
  UsbContentFirmwareError,
  UsbContentProtocolError,
  type UsbContentSerialPort
} from './usb-content-transfer'
import {
  clearActiveUsbPort,
  getActiveUsbPort,
  setActiveUsbPort,
  withUsbDeploymentLock
} from './usb-deployment-lock'

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
  transferAttempts: number
  transferRetryDelayMs: number
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

async function getPreferredAuthorizedUsbContentPort(): Promise<UsbContentSerialPort | undefined> {
  return getActiveUsbPort() ?? (await getSingleAuthorizedUsbContentPort())
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
  reconnectDelayMs: 750,
  transferAttempts: 3,
  transferRetryDelayMs: 750
}

function recoverableFirmwareError(error: unknown): UsbContentFirmwareError | null {
  if (!(error instanceof UsbContentFirmwareError)) return null
  return error.issue === 'capacity' ? null : error
}

function retryableReconnectError(error: unknown): boolean {
  return (
    error instanceof UsbContentDeviceUnavailableError ||
    error instanceof UsbContentProtocolError ||
    Boolean(recoverableFirmwareError(error))
  )
}

function retryableContentTransferError(error: unknown): boolean {
  return (
    error instanceof UsbContentDeviceUnavailableError || error instanceof UsbContentProtocolError
  )
}

async function reconnectAndTransferUsbContent(
  options: TransferUsbContentWithFirmwareFallbackOptions,
  dependencies: UsbContentFirmwareDependencies,
  preserveSession: boolean
): Promise<TransferUsbContentWithFirmwareFallbackResult> {
  let lastError: unknown
  for (let attempt = 0; attempt < dependencies.reconnectAttempts; attempt += 1) {
    if (attempt > 0) await dependencies.delay(dependencies.reconnectDelayMs)
    const port =
      (await getPreferredAuthorizedUsbContentPort()) ??
      (await dependencies.getAuthorizedPort()) ??
      options.port
    try {
      options.onStage?.('transferring', '设备已恢复连接，正在上传内容')
      const capacity = await options.transfer(port, true)
      options.onStage?.('ready', '固件与内容已更新完成')
      if (preserveSession) setActiveUsbPort(port)
      return { port, capacity, firmwareUpdated: true }
    } catch (error) {
      if (!retryableReconnectError(error)) throw error
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('USB 基础固件更新后未能重新连接设备')
}

export async function transferUsbContentWithFirmwareFallback(
  options: TransferUsbContentWithFirmwareFallbackOptions,
  dependencies: UsbContentFirmwareDependencies = defaultDependencies
): Promise<TransferUsbContentWithFirmwareFallbackResult> {
  return withUsbDeploymentLock(() =>
    transferUsbContentWithFirmwareFallbackUnlocked(options, dependencies)
  )
}

async function transferUsbContentWithFirmwareFallbackUnlocked(
  options: TransferUsbContentWithFirmwareFallbackOptions,
  dependencies: UsbContentFirmwareDependencies
): Promise<TransferUsbContentWithFirmwareFallbackResult> {
  const sessionPort = getActiveUsbPort()
  options.onStage?.('checking', '正在连接设备并检查固件兼容性')
  let firmwarePort = options.port
  const transferAttempts = Math.max(1, dependencies.transferAttempts)
  for (let attempt = 0; attempt < transferAttempts; attempt += 1) {
    if (attempt > 0) {
      await dependencies.delay(dependencies.transferRetryDelayMs)
      firmwarePort = (await dependencies.getAuthorizedPort()) ?? firmwarePort
    }
    try {
      options.onStage?.(
        'transferring',
        attempt === 0 ? '设备固件兼容，正在上传内容' : 'USB 连接已恢复，正在重新上传内容'
      )
      const capacity = await options.transfer(firmwarePort, false)
      options.onStage?.('ready', '内容上传完成')
      return { port: firmwarePort, capacity, firmwareUpdated: false }
    } catch (error) {
      const firmwareError = recoverableFirmwareError(error)
      if (firmwareError) {
        options.onLog?.(`设备固件需要自动更新：${firmwareError.message}`)
        break
      }
      if (!retryableContentTransferError(error) || attempt + 1 >= transferAttempts) throw error
      clearActiveUsbPort(firmwarePort)
      const message = error instanceof Error ? error.message : String(error)
      options.onLog?.(
        `USB 内容传输连接异常，正在自动重新建链（${attempt + 1}/${transferAttempts - 1}）：${message}`
      )
    }
  }

  options.onStage?.('flashing', '正在自动更新 USB 基础固件')
  await dependencies.flashManifest(options.manifestUrl, 'usb-frame', {
    port: firmwarePort as SerialPortLike,
    onLog: options.onLog,
    onProgress: options.onProgress
  })
  clearActiveUsbPort(firmwarePort)

  options.onStage?.('reconnecting', '基础固件已更新，正在等待设备重启并恢复连接')
  return reconnectAndTransferUsbContent(options, dependencies, Boolean(sessionPort))
}
