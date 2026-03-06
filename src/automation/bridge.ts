/**
 * Automation bridge — runs in the Vite/Bun process (NOT in the browser).
 *
 * The browser page connects via WebSocket and registers itself
 * as the RPC executor. CLI/MCP clients connect via HTTP.
 *
 * Flow: CLI → HTTP POST /rpc → bridge → WebSocket → browser → execute → response
 */

const AUTOMATION_PORT = 7600
const AUTOMATION_WS_PORT = 7601
const RPC_TIMEOUT = 30_000

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bun WebSocket type not available in browser tsconfig
type BunWebSocket = any

const pending = new Map<string, PendingRequest>()
let browserWs: BunWebSocket | null = null
let authToken: string | null = null

function sendToBrowser(body: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!browserWs) {
      reject(new Error('OpenPencil app is not connected'))
      return
    }
    const id = crypto.randomUUID()
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('RPC timeout (30s)'))
    }, RPC_TIMEOUT)
    pending.set(id, { resolve, reject, timer })
    browserWs.send(JSON.stringify({ type: 'request', id, ...body }))
  })
}

function handleBrowserMessage(data: string) {
  try {
    const msg = JSON.parse(data) as {
      type: string
      id?: string
      token?: string
      result?: unknown
      error?: string
      ok?: boolean
    }
    if (msg.type === 'register' && msg.token) {
      authToken = msg.token
      return
    }
    if (msg.type === 'response' && msg.id) {
      const req = pending.get(msg.id)
      if (!req) return
      pending.delete(msg.id)
      clearTimeout(req.timer)
      if (msg.ok === false) req.reject(new Error(msg.error ?? 'RPC failed'))
      else req.resolve(msg.result)
    }
  } catch {
    // ignore
  }
}

export function startAutomationBridge() {
  // @ts-expect-error -- Bun global not in browser tsconfig, but this file runs in Vite/Bun
  const BunGlobal = globalThis.Bun
  if (!BunGlobal) {
    console.warn('[automation] Bun runtime not available, skipping bridge')
    return
  }

  BunGlobal.serve({
    port: AUTOMATION_WS_PORT,
    hostname: '127.0.0.1',
    fetch(req: Request, server: { upgrade: (req: Request) => boolean }) {
      if (server.upgrade(req)) return undefined
      return new Response('WebSocket only', { status: 400 })
    },
    websocket: {
      open(ws: BunWebSocket) {
        browserWs = ws
      },
      message(_ws: BunWebSocket, message: string | ArrayBuffer) {
        handleBrowserMessage(
          typeof message === 'string' ? message : new TextDecoder().decode(message as ArrayBuffer)
        )
      },
      close(ws: BunWebSocket) {
        if (browserWs === ws) {
          browserWs = null
          authToken = null
          for (const [id, req] of pending) {
            clearTimeout(req.timer)
            req.reject(new Error('Browser disconnected'))
            pending.delete(id)
          }
        }
      }
    }
  })

  BunGlobal.serve({
    port: AUTOMATION_PORT,
    hostname: '127.0.0.1',
    async fetch(req: Request) {
      const url = new URL(req.url)
      const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type'
      }

      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers })
      }

      if (url.pathname === '/health') {
        return Response.json(
          {
            status: browserWs ? 'ok' : 'no_app',
            ...(browserWs && authToken ? { token: authToken } : {})
          },
          { headers }
        )
      }

      if (!browserWs || !authToken) {
        return Response.json(
          { error: 'OpenPencil app is not connected. Is a document open?' },
          { status: 503, headers }
        )
      }

      const auth = req.headers.get('authorization')
      const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null
      if (provided !== authToken) {
        return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
      }

      if (url.pathname === '/rpc' && req.method === 'POST') {
        const body = await req.json().catch(() => null)
        if (!body || typeof body !== 'object') {
          return Response.json({ error: 'Invalid request body' }, { status: 400, headers })
        }
        try {
          const result = await sendToBrowser(body as Record<string, unknown>)
          return Response.json({ ok: true, result }, { headers })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          return Response.json({ ok: false, error: msg }, { status: 502, headers })
        }
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers })
    }
  })

  console.log(`[automation] HTTP  http://127.0.0.1:${AUTOMATION_PORT}`)
  console.log(`[automation] WS    ws://127.0.0.1:${AUTOMATION_WS_PORT}`)
}
