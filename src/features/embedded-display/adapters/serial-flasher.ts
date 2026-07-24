import { ESPLoader, Transport } from 'esptool-js'
import type { FlashSizeValues } from 'esptool-js'

const DEFAULT_BAUD_RATE = 921600

export interface SerialFirmwarePart {
  address: number
  data: Uint8Array
}

export interface SerialFlashProgress {
  written: number
  total: number
  percent: number
}

export type SerialPortLike = ConstructorParameters<typeof Transport>[0]

export interface SerialFlashOptions {
  flashSize: FlashSizeValues
  port?: SerialPortLike
  baudRate?: number
  eraseAll?: boolean
  preparingMessage?: string
  connectedMessage?: string
  onLog?: (message: string) => void
  onProgress?: (progress: SerialFlashProgress) => void
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

async function resetDevice(transport: Transport, loader: ESPLoader): Promise<void> {
  await transport.setDTR(false)
  await transport.setRTS(true)
  await delay(120)
  await loader.after('hard_reset')
  await delay(300)
}

export async function fetchSerialFirmwarePart(
  path: string,
  address: number
): Promise<SerialFirmwarePart> {
  const response = await fetch(path, { cache: 'no-store' })
  if (!response.ok) throw new Error(`无法读取固件分区：${response.status}`)
  return { address, data: new Uint8Array(await response.arrayBuffer()) }
}

export function requestSerialPort(): Promise<SerialPortLike> {
  const serial = (
    navigator as Navigator & {
      serial?: { requestPort: () => Promise<SerialPortLike> }
    }
  ).serial
  if (!serial) throw new Error('当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge')
  return serial.requestPort()
}

export async function flashSerialFirmware(
  firmwareParts: SerialFirmwarePart[],
  options: SerialFlashOptions
): Promise<void> {
  if (!firmwareParts.length) throw new Error('固件清单中没有可烧录分区')
  options.onLog?.(options.preparingMessage ?? '正在准备固件…')
  const totalBytes = firmwareParts.reduce((sum, part) => sum + part.data.byteLength, 0)
  const completedBytes = firmwareParts.map((_, index) =>
    firmwareParts.slice(0, index).reduce((sum, part) => sum + part.data.byteLength, 0)
  )

  const port = options.port ?? (await requestSerialPort())
  const transport = new Transport(port, false)
  const loader = new ESPLoader({
    transport,
    baudrate: options.baudRate ?? DEFAULT_BAUD_RATE,
    terminal: {
      clean: () => undefined,
      write: (message) => options.onLog?.(message),
      writeLine: (message) => options.onLog?.(message)
    }
  })

  try {
    options.onLog?.('正在连接 ESP32-S3…')
    await loader.main()
    options.onLog?.(options.connectedMessage ?? '已连接，正在写入固件。')
    await loader.writeFlash({
      fileArray: firmwareParts,
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: options.flashSize,
      eraseAll: options.eraseAll ?? false,
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
    await resetDevice(transport, loader)
  } finally {
    try {
      await transport.disconnect()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      options.onLog?.(`串口已随设备重启释放：${message}`)
    }
  }
}
