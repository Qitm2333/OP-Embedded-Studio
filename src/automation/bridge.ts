/**
 * Automation bridge — runs in the Vite process (Node.js or Bun).
 *
 * Hono HTTP server on :7600 for CLI/MCP clients.
 * ws WebSocket server on :7601 for the browser page.
 *
 * Flow: CLI → HTTP POST /rpc → Hono → WebSocket → browser → execute → response
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocketServer, type WebSocket } from 'ws'

const AUTOMATION_PORT = 7600
const AUTOMATION_WS_PORT = 7601
const RPC_TIMEOUT = 30_000

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingRequest>()
let browserWs: WebSocket | null = null
let authToken: string | null = null

function sendToBrowser(body: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!browserWs || browserWs.readyState !== browserWs.OPEN) {
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
    // ignore malformed messages
  }
}

export function startAutomationBridge() {
  const wss = new WebSocketServer({ port: AUTOMATION_WS_PORT, host: '127.0.0.1' })

  wss.on('connection', (ws) => {
    browserWs = ws

    ws.on('message', (raw) => {
      handleBrowserMessage(typeof raw === 'string' ? raw : raw.toString('utf-8'))
    })

    ws.on('close', () => {
      if (browserWs === ws) {
        browserWs = null
        authToken = null
        for (const [id, req] of pending) {
          clearTimeout(req.timer)
          req.reject(new Error('Browser disconnected'))
          pending.delete(id)
        }
      }
    })
  })

  const app = new Hono()
  app.use('*', cors())

  app.get('/health', (c) => {
    return c.json({
      status: browserWs ? 'ok' : 'no_app',
      ...(browserWs && authToken ? { token: authToken } : {})
    })
  })

  app.use('/rpc', async (c, next) => {
    if (!browserWs || !authToken) {
      return c.json({ error: 'OpenPencil app is not connected. Is a document open?' }, 503)
    }
    const auth = c.req.header('authorization')
    const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : null
    if (provided !== authToken) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    await next()
  })

  app.post('/rpc', async (c) => {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid request body' }, 400)
    }
    try {
      const result = await sendToBrowser(body as Record<string, unknown>)
      return c.json({ ok: true, result })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ ok: false, error: msg }, 502)
    }
  })

  startServer(app)

  console.log(`[automation] HTTP  http://127.0.0.1:${AUTOMATION_PORT}`)
  console.log(`[automation] WS    ws://127.0.0.1:${AUTOMATION_WS_PORT}`)
}

async function startServer(app: Hono) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime detection across Bun/Node
  if ((globalThis as any).Bun !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Bun.serve not in Node types
    ;(globalThis as any).Bun.serve({ fetch: app.fetch, port: AUTOMATION_PORT, hostname: '127.0.0.1' })
  } else {
    const { serve } = await import('@hono/node-server')
    serve({ fetch: app.fetch, port: AUTOMATION_PORT, hostname: '127.0.0.1' })
  }
}
