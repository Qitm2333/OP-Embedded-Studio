import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedPrototypeBakeResult,
  EmbeddedPrototypePayload
} from '../model/types'

function base64FromBytes(bytes: Uint8Array): string {
  let result = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(result)
}

function bytesFromBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

export async function imageFileToRgb565(
  file: File,
  profile: EmbeddedDisplayProfile
): Promise<EmbeddedImagePayload> {
  const width = profile.resolution.width
  const height = profile.resolution.height
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建图片预览画布')

  context.fillStyle = '#000000'
  context.fillRect(0, 0, width, height)
  const scale = Math.min(width / bitmap.width, height / bitmap.height)
  const drawWidth = Math.round(bitmap.width * scale)
  const drawHeight = Math.round(bitmap.height * scale)
  context.drawImage(
    bitmap,
    Math.round((width - drawWidth) / 2),
    Math.round((height - drawHeight) / 2),
    drawWidth,
    drawHeight
  )
  bitmap.close()

  const pixels = context.getImageData(0, 0, width, height).data
  const rgb565 = new Uint8Array(width * height * 2)
  const isBgr = profile.image?.colorOrder === 'BGR'
  const isBigEndian = profile.image?.byteOrder === 'big'

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4
    const red = pixels[offset]
    const green = pixels[offset + 1]
    const blue = pixels[offset + 2]
    const first = isBgr ? blue : red
    const last = isBgr ? red : blue
    const value = ((first & 0xf8) << 8) | ((green & 0xfc) << 3) | (last >> 3)

    if (isBigEndian) {
      rgb565[pixel * 2] = value >> 8
      rgb565[pixel * 2 + 1] = value & 0xff
    } else {
      rgb565[pixel * 2] = value & 0xff
      rgb565[pixel * 2 + 1] = value >> 8
    }
  }

  return {
    profileId: profile.id,
    name: file.name.replace(/\.[^.]+$/, '') || 'open-pencil-image',
    width,
    height,
    frameCount: 1,
    frameDelayMs: 1000,
    pixelsRgb565Base64: base64FromBytes(rgb565)
  }
}

export async function prototypeBakeToRgb565(
  bake: EmbeddedPrototypeBakeResult,
  profile: EmbeddedDisplayProfile
): Promise<EmbeddedPrototypePayload> {
  const stateIndex = new Map(bake.states.map((state, index) => [state.id, index]))
  const initialStateIndex = stateIndex.get(bake.initialStateId)
  if (initialStateIndex === undefined) throw new Error('状态机缺少有效的初始状态')

  const frameBytes: Uint8Array[] = []
  for (const state of bake.states) {
    const payload = await imageFileToRgb565(state.file, profile)
    frameBytes.push(bytesFromBase64(payload.pixelsRgb565Base64))
  }
  const pixels = new Uint8Array(frameBytes.reduce((total, bytes) => total + bytes.length, 0))
  let offset = 0
  for (const bytes of frameBytes) {
    pixels.set(bytes, offset)
    offset += bytes.length
  }

  return {
    profileId: profile.id,
    name: bake.name,
    width: profile.resolution.width,
    height: profile.resolution.height,
    initialStateIndex,
    states: bake.states.map((state) => ({ id: state.id, name: state.name })),
    transitions: bake.transitions.flatMap((transition) => {
      const fromStateIndex = stateIndex.get(transition.fromStateId)
      const toStateIndex = stateIndex.get(transition.toStateId)
      return fromStateIndex === undefined || toStateIndex === undefined
        ? []
        : [{ fromStateIndex, event: transition.event, toStateIndex }]
    }),
    pixelsRgb565Base64: base64FromBytes(pixels)
  }
}
