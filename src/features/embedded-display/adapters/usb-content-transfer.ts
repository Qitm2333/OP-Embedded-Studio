import { requestSerialPort, type SerialFlashProgress } from './serial-flasher'

const USB_PROTOCOL_PREFIX = 'OPUSB/1'
const USB_CONTENT_HEADER_BYTES = 24
const USB_CONTENT_CHUNK_BYTES = 0x10000
const USB_CONTENT_MAGIC = 0x4f504331
const USB_CONTENT_SERVICE_VERSION = 2
const USB_HANDSHAKE_TIMEOUT_MS = 2500
const USB_COMMAND_TIMEOUT_MS = 15000

export type UsbContentFirmwareIssue = 'missing' | 'protocol' | 'resolution' | 'capacity'

export class UsbContentFirmwareError extends Error {
  constructor(
    readonly issue: UsbContentFirmwareIssue,
    message: string
  ) {
    super(message)
    this.name = 'UsbContentFirmwareError'
  }
}

export class UsbContentDeviceUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsbContentDeviceUnavailableError'
  }
}

export class UsbContentProtocolError extends Error {
  constructor(
    readonly operation: string,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'UsbContentProtocolError'
  }
}

export type UsbContentProbeResult =
  | { compatible: true; capacity: number }
  | { compatible: false; issue: UsbContentFirmwareIssue; message: string }

export interface UsbContentSerialPort {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>
  close(): Promise<void>
}

interface ProtocolReaderState {
  pending: string
}

interface EncodedUsbChunk {
  codec: 0 | 1
  bytes: Uint8Array
}

export interface UsbContentTransferOptions {
  port?: UsbContentSerialPort
  onLog?: (message: string) => void
  onProgress?: (progress: SerialFlashProgress) => void
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('等待 USB 设备响应超时')), milliseconds)
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function readProtocolLine(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  state: ProtocolReaderState,
  timeoutMs: number
): Promise<string> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const newline = state.pending.indexOf('\n')
    if (newline !== -1) {
      const line = state.pending.slice(0, newline).replace(/\r$/, '')
      state.pending = state.pending.slice(newline + 1)
      if (line.startsWith(USB_PROTOCOL_PREFIX)) return line
      continue
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('等待 USB 设备响应超时')
    const result = await withTimeout(reader.read(), remaining)
    if (result.done) throw new Error('USB 设备已断开')
    state.pending += new TextDecoder().decode(result.value, { stream: true })
  }
}

function assertProtocolResponse(line: string, expected: string): void {
  const error = line.match(/^OPUSB\/1 ERR (-?\d+) (\S+)$/)
  if (error) {
    const [, code, operation] = error
    throw new UsbContentProtocolError(
      operation,
      code,
      `USB 设备拒绝内容：${operation}（错误码 ${code}；${USB_PROTOCOL_PREFIX} ERR ${code} ${operation}）`
    )
  }
  if (line !== `${USB_PROTOCOL_PREFIX} ${expected}`) {
    throw new Error(`USB 设备响应异常：${line}`)
  }
}

async function deflateChunk(bytes: Uint8Array): Promise<EncodedUsbChunk> {
  if (typeof CompressionStream === 'undefined') return { codec: 0, bytes }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const compressedStream = new Blob([copy.buffer])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer())
  return compressed.byteLength < bytes.byteLength
    ? { codec: 1, bytes: compressed }
    : { codec: 0, bytes }
}

function validateContent(content: Uint8Array): void {
  if (content.byteLength < USB_CONTENT_HEADER_BYTES) throw new Error('USB 内容数据不完整')
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength)
  if (view.getUint32(0, true) !== USB_CONTENT_MAGIC) throw new Error('USB 内容格式无效')
  if (view.getUint32(16, true) + USB_CONTENT_HEADER_BYTES !== content.byteLength) {
    throw new Error('USB 内容长度与头信息不一致')
  }
}

function writeProtocolLine(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  line: string
): Promise<void> {
  return writer.write(new TextEncoder().encode(`${USB_PROTOCOL_PREFIX} ${line}\n`))
}

async function handshakeUsbDevice(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  state: ProtocolReaderState,
  profile: { width: number; height: number },
  contentBytes: number,
  options: { timeoutIsMissing?: boolean } = {}
): Promise<number> {
  await writeProtocolLine(writer, 'HELLO')
  const deadline = Date.now() + USB_HANDSHAKE_TIMEOUT_MS
  let line = ''
  try {
    for (;;) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new Error('等待 USB 设备响应超时')
      line = await readProtocolLine(reader, state, remaining)
      if (/^OPUSB\/1 (?:ERR -?\d+ \S+|ABORTED)$/u.test(line)) {
        await writeProtocolLine(writer, 'HELLO')
        continue
      }
      break
    }
  } catch (error) {
    if (options.timeoutIsMissing) {
      throw new UsbContentFirmwareError('missing', '设备未运行兼容的 USB 高速基础固件')
    }
    throw new UsbContentDeviceUnavailableError(
      error instanceof Error ? error.message : 'USB 设备尚未准备好'
    )
  }
  const ready = line.match(/^OPUSB\/1 READY (\d+) (\d+) (\d+) (\d+)$/)
  if (!ready) {
    throw new UsbContentFirmwareError('protocol', `USB 高速固件握手失败：${line}`)
  }
  const version = Number(ready[1])
  const width = Number(ready[2])
  const height = Number(ready[3])
  const capacity = Number(ready[4])
  if (version !== USB_CONTENT_SERVICE_VERSION) {
    throw new UsbContentFirmwareError(
      'protocol',
      `设备内容服务版本为 ${version}，Studio 需要版本 ${USB_CONTENT_SERVICE_VERSION}`
    )
  }
  if (width !== profile.width || height !== profile.height) {
    throw new UsbContentFirmwareError(
      'resolution',
      `设备分辨率为 ${width} × ${height}，与当前方案不匹配`
    )
  }
  if (contentBytes > capacity) {
    throw new UsbContentFirmwareError(
      'capacity',
      '内容超过设备 USB 内容分区容量，请减少图片或画面数量后重试'
    )
  }
  return capacity
}

export async function probeUsbContentDevice(
  port: UsbContentSerialPort,
  profile: { width: number; height: number },
  contentBytes: number
): Promise<UsbContentProbeResult> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  try {
    await port.open({ baudRate: 115200, bufferSize: 0x40000 })
    await port.setSignals?.({ dataTerminalReady: false, requestToSend: false })
    if (!port.readable || !port.writable) throw new Error('USB 串口数据流不可用')
    reader = port.readable.getReader()
    writer = port.writable.getWriter()
    const capacity = await handshakeUsbDevice(
      reader,
      writer,
      { pending: '' },
      profile,
      contentBytes,
      { timeoutIsMissing: true }
    )
    return { compatible: true, capacity }
  } catch (error) {
    if (error instanceof UsbContentFirmwareError) {
      return { compatible: false, issue: error.issue, message: error.message }
    }
    throw error
  } finally {
    await closeSerialPort(port, reader, writer)
  }
}

async function transferUsbPayload(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  state: ProtocolReaderState,
  content: Uint8Array,
  options: UsbContentTransferOptions
): Promise<number> {
  const payload = content.subarray(USB_CONTENT_HEADER_BYTES)
  let payloadOffset = 0
  let wireBytes = USB_CONTENT_HEADER_BYTES
  while (payloadOffset < payload.byteLength) {
    const raw = payload.subarray(
      payloadOffset,
      Math.min(payloadOffset + USB_CONTENT_CHUNK_BYTES, payload.byteLength)
    )
    const encoded = await deflateChunk(raw)
    await writeProtocolLine(
      writer,
      `CHUNK ${payloadOffset} ${raw.byteLength} ${encoded.bytes.byteLength} ${encoded.codec}`
    )
    await writer.write(encoded.bytes)
    const nextOffset = payloadOffset + raw.byteLength
    assertProtocolResponse(
      await readProtocolLine(reader, state, USB_COMMAND_TIMEOUT_MS),
      `ACK ${nextOffset}`
    )
    payloadOffset = nextOffset
    wireBytes += encoded.bytes.byteLength
    options.onProgress?.({
      written: USB_CONTENT_HEADER_BYTES + payloadOffset,
      total: content.byteLength,
      percent: Math.round((payloadOffset / payload.byteLength) * 100)
    })
  }
  return wireBytes
}

async function closeSerialPort(
  port: UsbContentSerialPort,
  reader: ReadableStreamDefaultReader<Uint8Array> | null,
  writer: WritableStreamDefaultWriter<Uint8Array> | null
): Promise<void> {
  try {
    await reader?.cancel()
  } catch (cleanupError) {
    void cleanupError
  }
  reader?.releaseLock()
  writer?.releaseLock()
  try {
    await port.close()
  } catch (cleanupError) {
    void cleanupError
  }
}

export async function uploadUsbContent(
  profile: { width: number; height: number },
  content: Uint8Array,
  options: UsbContentTransferOptions = {}
): Promise<number> {
  validateContent(content)
  const port = options.port ?? ((await requestSerialPort()) as UsbContentSerialPort)
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  let transferStarted = false

  try {
    options.onLog?.('正在连接 USB 高速内容服务…')
    try {
      await port.open({ baudRate: 115200, bufferSize: 0x40000 })
      await port.setSignals?.({ dataTerminalReady: false, requestToSend: false })
    } catch (error) {
      const name = error instanceof Error ? error.name : ''
      if (name === 'SecurityError' || name === 'NotAllowedError') throw error
      const message = error instanceof Error ? error.message : String(error)
      throw new UsbContentDeviceUnavailableError(`USB 设备尚未恢复连接：${message}`)
    }
    if (!port.readable || !port.writable) {
      throw new UsbContentDeviceUnavailableError('USB 设备串口尚未准备完成')
    }
    reader = port.readable.getReader()
    writer = port.writable.getWriter()
    const readerState: ProtocolReaderState = { pending: '' }
    const capacity = await handshakeUsbDevice(
      reader,
      writer,
      readerState,
      profile,
      content.byteLength
    )

    options.onLog?.(`USB 高速固件已连接，内容容量 ${(capacity / 1024 / 1024).toFixed(2)} MiB`)
    await writeProtocolLine(writer, `BEGIN ${content.byteLength}`)
    await writer.write(content.subarray(0, USB_CONTENT_HEADER_BYTES))
    assertProtocolResponse(
      await readProtocolLine(reader, readerState, USB_COMMAND_TIMEOUT_MS),
      'ACK 0'
    )
    transferStarted = true

    const wireBytes = await transferUsbPayload(reader, writer, readerState, content, options)

    options.onLog?.(
      `内容传输完成：${(content.byteLength / 1024 / 1024).toFixed(2)} MiB，USB 实际发送 ${(wireBytes / 1024 / 1024).toFixed(2)} MiB`
    )
    await writeProtocolLine(writer, 'END')
    assertProtocolResponse(
      await readProtocolLine(reader, readerState, USB_COMMAND_TIMEOUT_MS),
      'DONE'
    )
    transferStarted = false
    options.onProgress?.({ written: content.byteLength, total: content.byteLength, percent: 100 })
    options.onLog?.('内容校验通过，设备正在重启。')
    return capacity
  } catch (error) {
    if (transferStarted && writer) {
      try {
        await writer.write(new TextEncoder().encode(`${USB_PROTOCOL_PREFIX} ABORT\n`))
      } catch (abortError) {
        void abortError
      }
    }
    throw error
  } finally {
    await closeSerialPort(port, reader, writer)
  }
}
