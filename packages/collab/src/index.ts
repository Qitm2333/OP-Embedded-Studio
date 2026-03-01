import { DurableObject } from 'cloudflare:workers'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const MSG_SYNC = 0
const MSG_AWARENESS = 1

interface Env {
  ROOMS: DurableObjectNamespace<CollabRoom>
}

export class CollabRoom extends DurableObject {
  doc: Y.Doc
  awareness: awarenessProtocol.Awareness

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.doc = new Y.Doc()
    this.awareness = new awarenessProtocol.Awareness(this.doc)

    // Restore persisted doc state
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Uint8Array>('doc')
      if (stored) {
        Y.applyUpdate(this.doc, new Uint8Array(stored))
      }
    })

    // Restore awareness from hibernated WebSockets
    for (const ws of this.ctx.getWebSockets()) {
      const tag = ws.deserializeAttachment() as { clientId: number } | null
      if (tag) {
        // Awareness state will be re-sent by the client on reconnect
      }
    }

    this.doc.on('update', (_update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      // Persist on server-originated updates (rare, mostly initial)
      this.persistDoc()
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return new Response('ok')
    }

    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.ctx.acceptWebSocket(server)

    const clientId = Math.floor(Math.random() * 0xFFFFFF)
    server.serializeAttachment({ clientId })

    // Send sync step 1 to the new peer
    const syncEncoder = encoding.createEncoder()
    encoding.writeVarUint(syncEncoder, MSG_SYNC)
    syncProtocol.writeSyncStep1(syncEncoder, this.doc)
    server.send(encoding.toUint8Array(syncEncoder))

    // Send current awareness states
    const awarenessStates = this.awareness.getStates()
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder()
      encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS)
      const update = awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        Array.from(awarenessStates.keys())
      )
      encoding.writeVarUint8Array(awarenessEncoder, update)
      server.send(encoding.toUint8Array(awarenessEncoder))
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    if (typeof message === 'string') return

    const data = new Uint8Array(message)
    const decoder = decoding.createDecoder(data)
    const msgType = decoding.readVarUint(decoder)

    switch (msgType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MSG_SYNC)
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, 'remote')

        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder))
        }

        // If we received an update (step 2 or update), broadcast to others
        if (syncMessageType === 1 || syncMessageType === 2) {
          this.broadcastExcept(ws, data)
          this.persistDoc()
        }
        break
      }

      case MSG_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder)
        awarenessProtocol.applyAwarenessUpdate(this.awareness, update, ws)
        this.broadcastExcept(ws, data)
        break
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const tag = ws.deserializeAttachment() as { clientId: number } | null
    if (tag) {
      awarenessProtocol.removeAwarenessStates(this.awareness, [tag.clientId], 'peer left')
      // Broadcast awareness removal
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MSG_AWARENESS)
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [tag.clientId])
      encoding.writeVarUint8Array(encoder, update)
      this.broadcastExcept(ws, encoding.toUint8Array(encoder))
    }
    ws.close(code, reason)
  }

  async webSocketError(ws: WebSocket) {
    const tag = ws.deserializeAttachment() as { clientId: number } | null
    if (tag) {
      awarenessProtocol.removeAwarenessStates(this.awareness, [tag.clientId], 'error')
    }
  }

  private broadcastExcept(sender: WebSocket, data: Uint8Array) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) {
        try {
          ws.send(data)
        } catch {
          // Peer disconnected
        }
      }
    }
  }

  private async persistDoc() {
    const state = Y.encodeStateAsUpdate(this.doc)
    await this.ctx.storage.put('doc', state)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders()
      })
    }

    // Route: /room/:roomId
    const match = url.pathname.match(/^\/room\/([a-zA-Z0-9_-]+)$/)
    if (!match) {
      return new Response('Not found', { status: 404, headers: corsHeaders() })
    }

    const roomId = match[1]
    const id = env.ROOMS.idFromName(roomId)
    const stub = env.ROOMS.get(id)

    const response = await stub.fetch(request)

    // Add CORS headers for non-WebSocket responses
    if (response.status !== 101) {
      const headers = new Headers(response.headers)
      for (const [key, value] of Object.entries(corsHeaders())) {
        headers.set(key, value)
      }
      return new Response(response.body, { status: response.status, headers })
    }

    return response
  }
} satisfies ExportedHandler<Env>

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Upgrade, Content-Type'
  }
}
