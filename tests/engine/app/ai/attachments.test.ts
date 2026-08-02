import { describe, expect, test } from 'bun:test'

import {
  CHAT_IMAGE_MAX_SOURCE_BYTES,
  parseImageDataUrl,
  validateChatImageFile
} from '@/app/ai/chat/attachments'

describe('chat image attachments', () => {
  test('parses supported base64 image data URLs', () => {
    expect(parseImageDataUrl('data:image/webp;base64,UklGRg==')).toEqual({
      mimeType: 'image/webp',
      data: 'UklGRg=='
    })
  })

  test('rejects hosted, non-image, and non-base64 URLs', () => {
    expect(parseImageDataUrl('https://example.com/reference.png')).toBeNull()
    expect(parseImageDataUrl('data:text/plain;base64,SGVsbG8=')).toBeNull()
    expect(parseImageDataUrl('data:image/png,raw')).toBeNull()
  })

  test('validates type and source size before browser decoding', () => {
    expect(validateChatImageFile({ type: 'image/png', size: 1024 })).toBeNull()
    expect(validateChatImageFile({ type: 'image/gif', size: 1024 })).toContain('PNG')
    expect(
      validateChatImageFile({ type: 'image/jpeg', size: CHAT_IMAGE_MAX_SOURCE_BYTES + 1 })
    ).toContain('12 MB')
  })
})
