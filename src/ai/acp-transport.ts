import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION
} from '@agentclientprotocol/sdk'
import { Command } from '@tauri-apps/plugin-shell'

import type {
  Client,
  Agent,
  SessionNotification,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionUpdate
} from '@agentclientprotocol/sdk'
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai'
import type { ACPAgentDef } from '@open-pencil/core'

interface ACPSession {
  connection: ClientSideConnection
  sessionId: string
  child: Awaited<ReturnType<Command<Uint8Array>['spawn']>>
  onUpdate: ((params: SessionNotification) => void) | null
}

export class ACPChatTransport implements ChatTransport<UIMessage> {
  private session: ACPSession | null = null
  private agentDef: ACPAgentDef
  private cwd: string

  constructor(options: { agentDef: ACPAgentDef; cwd?: string }) {
    this.agentDef = options.agentDef
    this.cwd = options.cwd ?? '.'
  }

  async sendMessages({
    messages,
    abortSignal
  }: Parameters<ChatTransport<UIMessage>['sendMessages']>[0]): Promise<
    ReadableStream<UIMessageChunk>
  > {
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user')
    const text =
      lastUserMessage?.parts
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n') ?? ''

    if (!this.session) {
      this.session = await this.spawnAgent()
    }

    const { connection, sessionId } = this.session
    const session = this.session

    return new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        const textId = `text-${Date.now()}`
        let textStarted = false

        session.onUpdate = (params) => {
          const result = mapUpdate(
            params.update,
            textId,
            textStarted
          )
          for (const chunk of result.chunks) {
            controller.enqueue(chunk)
          }
          textStarted = result.textStarted
        }

        abortSignal?.addEventListener('abort', () => {
          void connection.cancel({ sessionId })
        })

        controller.enqueue({ type: 'start' })
        controller.enqueue({ type: 'start-step' })

        connection
          .prompt({
            sessionId,
            prompt: [{ type: 'text', text }]
          })
          .then((result) => {
            if (textStarted) {
              controller.enqueue({ type: 'text-end', id: textId })
            }
            controller.enqueue({ type: 'finish-step' })
            controller.enqueue({
              type: 'finish',
              finishReason:
                result.stopReason === 'end_turn' ? 'stop' : 'other'
            })
          })
          .catch((e) => {
            const msg = e instanceof Error ? e.message : String(e)
            controller.enqueue({ type: 'error', errorText: msg })
            controller.enqueue({ type: 'finish', finishReason: 'error' })
          })
          .finally(() => {
            session.onUpdate = null
            controller.close()
          })
      }
    })
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }

  async destroy(): Promise<void> {
    if (this.session) {
      await this.session.child.kill()
      this.session = null
    }
  }

  private async spawnAgent(): Promise<ACPSession> {
    const command = Command.create(this.agentDef.command, this.agentDef.args, {
      encoding: 'raw'
    })

    const stdoutChunks: Uint8Array[] = []
    let stdoutResolver: ((chunk: Uint8Array) => void) | null = null

    command.stdout.on('data', (raw: Uint8Array | number[]) => {
      const chunk = raw instanceof Uint8Array ? raw : new Uint8Array(raw)
      if (stdoutResolver) {
        const resolve = stdoutResolver
        stdoutResolver = null
        resolve(chunk)
      } else {
        stdoutChunks.push(chunk)
      }
    })

    command.stderr.on('data', (raw: Uint8Array | number[] | string) => {
      const text = typeof raw === 'string'
        ? raw
        : new TextDecoder().decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
      console.error(`[ACP ${this.agentDef.id}]`, text)
    })

    const child = await command.spawn()

    const output = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const buffered = stdoutChunks.shift()
        if (buffered) {
          controller.enqueue(buffered)
          return
        }
        await new Promise<void>((resolve) => {
          stdoutResolver = (chunk) => {
            controller.enqueue(chunk)
            resolve()
          }
        })
      }
    })

    const input = new WritableStream<Uint8Array>({
      async write(chunk) {
        await child.write(Array.from(chunk))
      }
    })

    const stream = ndJsonStream(input, output)
    let onUpdate: ACPSession['onUpdate'] = null

    const clientImpl: Client = {
      async requestPermission(
        params: RequestPermissionRequest
      ): Promise<RequestPermissionResponse> {
        return {
          outcome: {
            outcome: 'selected',
            optionId: params.options[0]?.optionId ?? ''
          }
        }
      },

      async sessionUpdate(params: SessionNotification): Promise<void> {
        onUpdate?.(params)
      }
    }

    const connection = new ClientSideConnection(
      (_agent: Agent) => clientImpl,
      stream
    )

    await connection.initialize({
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {}
    })

    const sessionResult = await connection.newSession({
      cwd: this.cwd,
      mcpServers: []
    })

    const session: ACPSession = {
      connection,
      sessionId: sessionResult.sessionId,
      child,
      get onUpdate() { return onUpdate },
      set onUpdate(fn) { onUpdate = fn }
    }

    return session
  }
}

interface MapResult {
  chunks: UIMessageChunk[]
  textStarted: boolean
}

function mapUpdate(
  update: SessionUpdate,
  textId: string,
  textStarted: boolean
): MapResult {
  const chunks: UIMessageChunk[] = []

  switch (update.sessionUpdate) {
    case 'agent_message_chunk': {
      if (update.content.type === 'text' && update.content.text) {
        if (!textStarted) {
          chunks.push({ type: 'text-start', id: textId })
          textStarted = true
        }
        chunks.push({
          type: 'text-delta',
          id: textId,
          delta: update.content.text
        })
      }
      break
    }
    case 'agent_thought_chunk': {
      if (update.content.type === 'text') {
        const rid = `reasoning-${textId}`
        chunks.push({ type: 'reasoning-start', id: rid })
        chunks.push({
          type: 'reasoning-delta',
          id: rid,
          delta: update.content.text
        })
        chunks.push({ type: 'reasoning-end', id: rid })
      }
      break
    }
    case 'tool_call': {
      const toolName = update.title || 'unknown'
      chunks.push({
        type: 'tool-input-start',
        toolCallId: update.toolCallId,
        toolName,
        providerExecuted: true,
        title: update.title
      })
      if (update.rawInput) {
        chunks.push({
          type: 'tool-input-available',
          toolCallId: update.toolCallId,
          toolName,
          input: update.rawInput,
          providerExecuted: true,
          title: update.title
        })
      }
      break
    }
    case 'tool_call_update': {
      if (update.status === 'completed') {
        chunks.push({
          type: 'tool-output-available',
          toolCallId: update.toolCallId,
          output: update.rawOutput ?? textFromContent(update.content ?? undefined),
          providerExecuted: true
        })
      } else if (update.status === 'failed') {
        chunks.push({
          type: 'tool-output-error',
          toolCallId: update.toolCallId,
          errorText: textFromContent(update.content ?? undefined) ?? 'Tool call failed',
          providerExecuted: true
        })
      }
      break
    }
  }

  return { chunks, textStarted }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ACP content blocks have dynamic shape
function textFromContent(content: any[] | undefined): string | undefined {
  if (!content) return undefined
  return content
    .filter(
      (c: Record<string, unknown>) =>
        c.type === 'content' &&
        (c.content as Record<string, unknown> | undefined)?.type === 'text'
    )
    .map(
      (c: Record<string, unknown>) =>
        (c.content as Record<string, string>).text
    )
    .join('\n')
}
