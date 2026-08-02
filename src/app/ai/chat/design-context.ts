import type { ModelMessage } from 'ai'

type MessagePart = Record<string, unknown>

const OMITTED_IMAGE_TEXT =
  'Earlier reference image omitted from this request to keep the conversation compact.'

function isRecord(value: unknown): value is MessagePart {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isImagePart(part: MessagePart): boolean {
  if (part.type === 'image') return true
  return (
    part.type === 'file' &&
    typeof part.mediaType === 'string' &&
    part.mediaType.startsWith('image/')
  )
}

function compactHistoricalMessage(message: ModelMessage): ModelMessage {
  if (message.role !== 'user') return message
  if (!Array.isArray(message.content)) return message

  let removedImage = false
  const content: unknown[] = []
  for (const value of message.content as unknown[]) {
    if (!isRecord(value)) {
      content.push(value)
      continue
    }
    if (isImagePart(value)) {
      removedImage = true
      continue
    }
    content.push(value)
  }

  if (removedImage) {
    content.push({ type: 'text', text: OMITTED_IMAGE_TEXT })
  }
  return { ...message, content } as ModelMessage
}

function latestUserMessageIndex(messages: ModelMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role === 'user') return index
  }
  return messages.length
}

/**
 * Preserve the SDK's original message/tool sequence. Only old image payloads are
 * omitted; the latest user turn keeps its reference images intact.
 */
export function compactDesignContext(messages: ModelMessage[]): ModelMessage[] {
  const currentTurnStart = latestUserMessageIndex(messages)
  return messages.map((message, index) =>
    index < currentTurnStart ? compactHistoricalMessage(message) : message
  )
}
