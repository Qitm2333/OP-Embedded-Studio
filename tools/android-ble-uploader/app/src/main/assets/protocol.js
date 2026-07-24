(function () {
  const WIDTH = 466
  const HEIGHT = 466
  const CONTENT_MAGIC = 0x4f504331
  const CONTENT_VERSION = 1
  const HEADER_BYTES = 24
  const MAX_CONTENT_BYTES = 0x1cf0000
  const SEQUENCE_HEADER_BYTES = 12
  const RESOURCE_BYTES = 12

  function crc32(bytes) {
    let crc = 0xffffffff
    for (const byte of bytes) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
    return (crc ^ 0xffffffff) >>> 0
  }

  function envelope(mode, frameCount, payload) {
    const content = new Uint8Array(HEADER_BYTES + payload.byteLength)
    const view = new DataView(content.buffer)
    view.setUint32(0, CONTENT_MAGIC, true)
    view.setUint16(4, CONTENT_VERSION, true)
    view.setUint8(6, mode)
    view.setUint16(8, WIDTH, true)
    view.setUint16(10, HEIGHT, true)
    view.setUint16(12, frameCount, true)
    view.setUint32(16, payload.byteLength, true)
    view.setUint32(20, crc32(payload), true)
    content.set(payload, HEADER_BYTES)
    if (content.byteLength > MAX_CONTENT_BYTES) throw new Error('内容超过 28.94 MiB 上限')
    return content
  }

  function rgb565(imageData) {
    const source = imageData.data
    const output = new Uint8Array(WIDTH * HEIGHT * 2)
    for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
      const sourceOffset = pixel * 4
      const value =
        ((source[sourceOffset] & 0xf8) << 8) |
        ((source[sourceOffset + 1] & 0xfc) << 3) |
        (source[sourceOffset + 2] >> 3)
      output[pixel * 2] = value & 0xff
      output[pixel * 2 + 1] = value >> 8
    }
    return output
  }

  function encodeFrame(frame) {
    return envelope(0, 1, frame)
  }

  function encodeRle(frame) {
    const buffer = new Uint8Array(frame.byteLength * 2)
    let outputOffset = 0
    let offset = 0
    while (offset < frame.byteLength) {
      const low = frame[offset]
      const high = frame[offset + 1]
      let run = 1
      while (
        run < 0xffff &&
        offset + run * 2 < frame.byteLength &&
        frame[offset + run * 2] === low &&
        frame[offset + run * 2 + 1] === high
      ) run += 1
      buffer[outputOffset] = run & 0xff
      buffer[outputOffset + 1] = run >> 8
      buffer[outputOffset + 2] = low
      buffer[outputOffset + 3] = high
      outputOffset += 4
      offset += run * 2
    }
    return outputOffset < frame.byteLength
      ? { codec: 1, bytes: buffer.slice(0, outputOffset) }
      : { codec: 0, bytes: frame }
  }

  function encodeSequence(frames) {
    if (frames.length < 2) throw new Error('PNG 序列至少需要两张图片')
    const encoded = frames.map(encodeRle)
    const dataBytes = encoded.reduce((total, frame) => total + frame.bytes.byteLength, 0)
    const payload = new Uint8Array(SEQUENCE_HEADER_BYTES + frames.length * RESOURCE_BYTES + dataBytes)
    const view = new DataView(payload.buffer)
    view.setUint32(0, WIDTH * HEIGHT * 2, true)
    view.setUint16(4, 50, true)
    view.setUint16(6, frames.length, true)
    view.setUint32(8, dataBytes, true)
    const dataOffset = SEQUENCE_HEADER_BYTES + frames.length * RESOURCE_BYTES
    let storedOffset = 0
    encoded.forEach((frame, index) => {
      const resourceOffset = SEQUENCE_HEADER_BYTES + index * RESOURCE_BYTES
      view.setUint32(resourceOffset, storedOffset, true)
      view.setUint32(resourceOffset + 4, frame.bytes.byteLength, true)
      view.setUint8(resourceOffset + 8, frame.codec)
      payload.set(frame.bytes, dataOffset + storedOffset)
      storedOffset += frame.bytes.byteLength
    })
    return envelope(2, frames.length, payload)
  }

  window.OpenPencilProtocol = { WIDTH, HEIGHT, MAX_CONTENT_BYTES, rgb565, encodeFrame, encodeSequence }
})()
