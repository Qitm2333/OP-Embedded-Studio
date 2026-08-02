import type { FileUIPart } from 'ai'

export const CHAT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'
export const CHAT_IMAGE_MAX_COUNT = 4
export const CHAT_IMAGE_MAX_SOURCE_BYTES = 12 * 1024 * 1024
export const CHAT_IMAGE_MAX_DIMENSION = 2048
export const CHAT_IMAGE_MAX_PREPARED_BYTES = 5 * 1024 * 1024

const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export interface ParsedImageDataUrl {
  mimeType: string
  data: string
}

export function parseImageDataUrl(url: string): ParsedImageDataUrl | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/i.exec(url)
  if (!match) return null
  return { mimeType: match[1].toLowerCase(), data: match[2] }
}

export function validateChatImageFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    return 'Only PNG, JPEG, and WebP images are supported.'
  }
  if (file.size > CHAT_IMAGE_MAX_SOURCE_BYTES) {
    return 'Each reference image must be 12 MB or smaller.'
  }
  return null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to encode image'))
        return
      }
      resolve(reader.result)
    }
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to prepare image'))
          return
        }
        resolve(blob)
      },
      type,
      quality
    )
  })
}

export async function prepareChatImage(file: File): Promise<FileUIPart> {
  const validationError = validateChatImageFile(file)
  if (validationError) throw new Error(validationError)

  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, CHAT_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= CHAT_IMAGE_MAX_PREPARED_BYTES) {
      return {
        type: 'file',
        mediaType: file.type,
        filename: file.name,
        url: await blobToDataUrl(file)
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    let outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    let blob = await canvasToBlob(
      canvas,
      outputType,
      outputType === 'image/jpeg' ? 0.88 : undefined
    )
    if (blob.size > CHAT_IMAGE_MAX_PREPARED_BYTES && outputType === 'image/png') {
      context.globalCompositeOperation = 'destination-over'
      context.fillStyle = '#FFFFFF'
      context.fillRect(0, 0, canvas.width, canvas.height)
      outputType = 'image/jpeg'
      blob = await canvasToBlob(canvas, outputType, 0.84)
    }
    if (blob.size > CHAT_IMAGE_MAX_PREPARED_BYTES) {
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.7)
      outputType = 'image/jpeg'
    }
    if (blob.size > CHAT_IMAGE_MAX_PREPARED_BYTES) {
      throw new Error('Prepared reference image is still too large. Try a smaller crop.')
    }
    return {
      type: 'file',
      mediaType: outputType,
      filename: file.name,
      url: await blobToDataUrl(blob)
    }
  } finally {
    bitmap.close()
  }
}
