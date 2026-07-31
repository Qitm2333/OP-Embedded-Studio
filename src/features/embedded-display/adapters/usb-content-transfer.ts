import {
  requestSerialPort,
  type SerialFlashProgress
} from './serial-flasher'

const USB_PROTOCOL_PREFIX = 'OPUSB/1'
const USB_CONTENT_HEADER_BYTES = 24
const USB_CONTENT_CHUNK_BYTES = 0x10000
const USB_CONTENT_MAGIC = 0x4f504331
const USB_HANDSHAKE_TIMEOUT_MS = 2500
const USB_COMMAND_TIMEOUT_MS = 15000

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
  while (true) {
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
  if (line.startsWith(`${USB_PROTOCOL_PREFIX} ERR `)) {
    throw new Error(`USB 设备拒绝内容：${line.slice(USB_PROTOCOL_PREFIX.length + 5)}`)
  }
  if (line !== `${USB_PROTOCOL_PREFIX} ${expected}`) {
    throw new Error(`USB 设备响应异常：${line}`)
  }
}

async function deflateChunk(bytes: Uint8Array): Promise<EncodedUsbChunk> {
  if (typeof CompressionStream === 'undefined') return { codec: 0, bytes }
  const compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
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
  contentBytes: number
): Promise<number> {
  await writeProtocolLine(writer, 'HELLO')
  let line: string
  try {
    line = await readProtocolLine(reader, state, USB_HANDSHAKE_TIMEOUT_MS)
  } catch {
    throw new Error('设备未运行 USB 高速基础固件，请先在“首次使用 / 设备维护”中初始化')
  }
  const ready = line.match(/^OPUSB\/1 READY (\d+) (\d+) (\d+) (\d+)$/)
  if (!ready) throw new Error(`USB 高速固件握手失败：${line}`)
  const width = Number(ready[2])
  const height = Number(ready[3])
  const capacity = Number(ready[4])
  if (width !== profile.width || height !== profile.height) {
    throw new Error(`设备分辨率为 ${width} × ${height}，与当前方案不匹配`)
  }
  if (contentBytes > capacity) throw new Error('内容超过设备 USB 内容分区容量')
  return capacity
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
): Promise<void> {
  validateContent(content)
  const port = options.port ?? (await requestSerialPort() as UsbContentSerialPort)
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  let transferStarted = false

  try {
    options.onLog?.('正在连接 USB 高速内容服务…')
    await port.open({ baudRate: 115200, bufferSize: 0x40000 })
    await port.setSignals?.({ dataTerminalReady: false, requestToSend: false })
    if (!port.readable || !port.writable) throw new Error('USB 串口数据流不可用')
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
