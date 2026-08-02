export type AIErrorKind =
  | 'connection'
  | 'icon-library'
  | 'image'
  | 'svg'
  | 'request-size'
  | 'provider'
  | 'tool'

export interface AIErrorDescription {
  kind: AIErrorKind
  title: string
  message: string
  retryable: boolean
  detail: string
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error)
}

function containsAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value))
}

export function describeAIError(error: unknown): AIErrorDescription {
  const detail = errorText(error)
  const text = detail.toLowerCase()

  if (containsAny(text, ['iconify', 'icon library'])) {
    return {
      kind: 'icon-library',
      title: 'Icon library unavailable',
      message:
        'The remote icon service could not be reached. The AI should draw a local SVG instead.',
      retryable: true,
      detail
    }
  }
  if (containsAny(text, ['svg', 'vectornetwork', 'path parsing'])) {
    return {
      kind: 'svg',
      title: 'Vector import failed',
      message: 'The generated vector markup was invalid or used an unsupported SVG feature.',
      retryable: true,
      detail
    }
  }
  if (text.includes('image') && containsAny(text, ['large', 'encode'])) {
    return {
      kind: 'image',
      title: 'Image could not be prepared',
      message: 'The reference image could not be compressed or encoded for the selected model.',
      retryable: false,
      detail
    }
  }
  if (
    containsAny(text, [
      'context length',
      'too many tokens',
      'request too large',
      'payload too large'
    ])
  ) {
    return {
      kind: 'request-size',
      title: 'Conversation is too large',
      message:
        'The model request exceeded its context or payload limit. Older visual data was preserved as summaries.',
      retryable: true,
      detail
    }
  }
  if (containsAny(text, ['failed to fetch', 'network', 'timeout', 'connection'])) {
    return {
      kind: 'connection',
      title: 'Model connection interrupted',
      message:
        'The current canvas state is preserved. Retry the response without repeating successful edits.',
      retryable: true,
      detail
    }
  }
  if (
    containsAny(text, [
      'unauthorized',
      'forbidden',
      'api key',
      'rate limit',
      'upstream_error',
      'temporarily unavailable',
      'service unavailable',
      'overloaded'
    ]) ||
    /\b(401|403|429|503)\b/.test(text)
  ) {
    return {
      kind: 'provider',
      title: 'Model provider unavailable',
      message: 'The selected model service rejected the request or is temporarily unavailable.',
      retryable: true,
      detail
    }
  }
  return {
    kind: 'tool',
    title: 'AI operation failed',
    message: detail,
    retryable: true,
    detail
  }
}
