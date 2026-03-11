import type { UIMessage } from 'ai'

function formatToolPart(part: Record<string, unknown>): string {
  const inv = part.toolInvocation as Record<string, unknown> | undefined
  if (inv) {
    const lines = [`  [tool] ${String(inv.toolName)} (${String(inv.state)})`]
    if (inv.args) lines.push(`    args: ${JSON.stringify(inv.args)}`)
    if (inv.result !== undefined) lines.push(`    result: ${JSON.stringify(inv.result)}`)
    return lines.join('\n')
  }

  const name = (typeof part.type === 'string' ? part.type : 'unknown').replace(/^tool-/, '')
  const state = typeof part.state === 'string' ? part.state : '?'
  const lines = [`  [tool] ${name} (${state})`]
  if (part.input) lines.push(`    input: ${JSON.stringify(part.input)}`)
  if (part.output !== undefined) lines.push(`    output: ${JSON.stringify(part.output)}`)
  if (part.errorText) lines.push(`    error: ${part.errorText as string}`)
  return lines.join('\n')
}

export function serializeChatLog(messages: UIMessage[]): string {
  const sections: string[] = []

  for (const msg of messages) {
    const header = `=== ${msg.role.toUpperCase()} (${msg.id}) ===`
    const parts: string[] = []

    for (const part of msg.parts) {
      const p = part as Record<string, unknown>
      if (p.type === 'text') {
        parts.push(`  ${p.text as string}`)
      } else if (p.type === 'reasoning') {
        parts.push(
          `  [reasoning] ${typeof p.text === 'string' ? p.text : (typeof p.content === 'string' ? p.content : '')}`
        )
      } else if (
        p.type === 'tool-invocation' ||
        p.toolInvocation ||
        (typeof p.type === 'string' && p.type.startsWith('tool-'))
      ) {
        parts.push(formatToolPart(p))
      } else {
        parts.push(`  [${typeof p.type === 'string' ? p.type : 'unknown'}] ${JSON.stringify(p)}`)
      }
    }

    sections.push(`${header}\n${parts.join('\n')}`)
  }

  return sections.join('\n\n')
}

export function copyChatLog(messages: UIMessage[]): Promise<void> {
  const text = serializeChatLog(messages)
  return navigator.clipboard.writeText(text)
}
