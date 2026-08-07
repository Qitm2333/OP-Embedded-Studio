import { describe, expect, test } from 'bun:test'

import {
  probeUsbContentDevice,
  uploadUsbContent
} from '@/features/embedded-display/adapters/usb-content-transfer'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

class FakeUsbContentPort {
  readable: ReadableStream<Uint8Array> | null = null
  writable: WritableStream<Uint8Array> | null = null
  commands: string[] = []
  codecs: number[] = []
  private response: ReadableStreamDefaultController<Uint8Array> | null = null
  private pending: 'header' | 'chunk' | null = null
  private nextOffset = 0
  private helloResponseIndex = 0

  constructor(
    private readonly helloResponses: string | null | string[] = 'OPUSB/1 READY 2 466 466 30343168'
  ) {}

  async open() {
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.response = controller
      }
    })
    this.writable = new WritableStream<Uint8Array>({
      write: (bytes) => this.receive(bytes)
    })
  }

  async close() {
    this.readable = null
    this.writable = null
  }

  private reply(line: string) {
    this.response?.enqueue(encoder.encode(`${line}\n`))
  }

  private receive(bytes: Uint8Array) {
    if (this.pending === 'header') {
      expect(bytes.byteLength).toBe(24)
      this.pending = null
      this.reply('OPUSB/1 ACK 0')
      return
    }
    if (this.pending === 'chunk') {
      this.pending = null
      this.reply(`OPUSB/1 ACK ${this.nextOffset}`)
      return
    }

    const command = decoder.decode(bytes).trim()
    this.commands.push(command)
    if (command === 'OPUSB/1 HELLO') {
      const response = Array.isArray(this.helloResponses)
        ? this.helloResponses[Math.min(this.helloResponseIndex++, this.helloResponses.length - 1)]
        : this.helloResponses
      if (response) this.reply(response)
      else this.response?.close()
      return
    }
    if (command.startsWith('OPUSB/1 BEGIN ')) {
      this.pending = 'header'
      return
    }
    if (command.startsWith('OPUSB/1 CHUNK ')) {
      const fields = command.split(' ').map(Number)
      const offset = fields[2]
      const rawBytes = fields[3]
      this.codecs.push(fields[5])
      this.nextOffset = offset + rawBytes
      this.pending = 'chunk'
      return
    }
    if (command === 'OPUSB/1 END') this.reply('OPUSB/1 DONE')
  }
}

function createContent(payloadBytes: number): Uint8Array {
  const content = new Uint8Array(24 + payloadBytes)
  const view = new DataView(content.buffer)
  view.setUint32(0, 0x4f504331, true)
  view.setUint16(4, 1, true)
  view.setUint16(8, 466, true)
  view.setUint16(10, 466, true)
  view.setUint32(16, payloadBytes, true)
  content.fill(0x5a, 24)
  return content
}

describe('USB runtime content transfer', () => {
  test('probes firmware with HELLO without starting a content transfer', async () => {
    const port = new FakeUsbContentPort()

    await expect(probeUsbContentDevice(port, { width: 466, height: 466 }, 1024)).resolves.toEqual({
      compatible: true,
      capacity: 30343168
    })
    expect(port.commands).toEqual(['OPUSB/1 HELLO'])
  })

  test('classifies missing, resolution, and capacity firmware problems', async () => {
    const missing = new FakeUsbContentPort(null)
    const resolution = new FakeUsbContentPort('OPUSB/1 READY 2 240 240 30343168')
    const capacity = new FakeUsbContentPort('OPUSB/1 READY 2 466 466 100')

    await expect(
      probeUsbContentDevice(missing, { width: 466, height: 466 }, 90)
    ).resolves.toMatchObject({
      compatible: false,
      issue: 'missing'
    })
    await expect(
      probeUsbContentDevice(resolution, { width: 466, height: 466 }, 90)
    ).resolves.toMatchObject({ compatible: false, issue: 'resolution' })
    await expect(
      probeUsbContentDevice(capacity, { width: 466, height: 466 }, 101)
    ).resolves.toMatchObject({
      compatible: false,
      issue: 'capacity'
    })
    expect(missing.commands).toEqual(['OPUSB/1 HELLO'])
    expect(resolution.commands).toEqual(['OPUSB/1 HELLO'])
    expect(capacity.commands).toEqual(['OPUSB/1 HELLO'])
  })

  test('recovers from stale transaction responses before READY', async () => {
    const port = new FakeUsbContentPort([
      'OPUSB/1 ERR -3 chunk_data',
      'OPUSB/1 ABORTED',
      'OPUSB/1 READY 2 466 466 30343168'
    ])

    await expect(probeUsbContentDevice(port, { width: 466, height: 466 }, 1024)).resolves.toEqual({
      compatible: true,
      capacity: 30343168
    })
    expect(port.commands).toEqual(['OPUSB/1 HELLO', 'OPUSB/1 HELLO', 'OPUSB/1 HELLO'])
  })

  test('rejects an outdated content service version', async () => {
    const port = new FakeUsbContentPort('OPUSB/1 READY 1 466 466 30343168')

    await expect(
      probeUsbContentDevice(port, { width: 466, height: 466 }, 1024)
    ).resolves.toMatchObject({ compatible: false, issue: 'protocol' })
  })

  test('handshakes, compresses chunks, and finishes without reflashing firmware', async () => {
    const port = new FakeUsbContentPort()
    const progress: number[] = []
    await uploadUsbContent({ width: 466, height: 466 }, createContent(0x18000), {
      port,
      onProgress: ({ percent }) => progress.push(percent)
    })

    expect(port.commands[0]).toBe('OPUSB/1 HELLO')
    expect(port.commands.some((command) => command.startsWith('OPUSB/1 BEGIN '))).toBe(true)
    expect(port.commands.filter((command) => command.startsWith('OPUSB/1 CHUNK '))).toHaveLength(2)
    expect(port.codecs).toEqual([1, 1])
    expect(port.commands.at(-1)).toBe('OPUSB/1 END')
    expect(progress.at(-1)).toBe(100)
  })
})
