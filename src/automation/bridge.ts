/**
 * Automation bridge — runs in the Vite process (Node.js or Bun).
 *
 * Hono HTTP server on :7600 for CLI/MCP clients.
 * ws WebSocket server on :7601 for the browser page.
 *
 * Flow: CLI → HTTP POST /rpc → Hono → WebSocket → browser → execute → response
 *
 * Security model: same-machine trust. Both HTTP and WebSocket bind to 127.0.0.1.
 * The browser generates a random bearer token and registers it via WebSocket.
 * GET /health exposes the token so the CLI can discover it — this is intentional:
 * any local process can access the bridge, and the token only prevents accidental
 * cross-session collisions when multiple instances are running.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocketServer, type WebSocket } from 'ws'

import type { ZodTypeAny } from 'zod'

// Can't import from @open-pencil/core here — this file is bundled by esbuild
// as part of the Vite config, and workspace packages are externalized then
// loaded by Node's ESM resolver which can't handle .ts source imports.
const AUTOMATION_HTTP_PORT = 7600
const AUTOMATION_WS_PORT = 7601
const RPC_TIMEOUT = 30_000

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type ViteServer = { ssrLoadModule: (id: string) => Promise<Record<string, unknown>> }

export function startAutomationBridge(server: ViteServer) {
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
        else {
          const { type: _, id: __, ...payload } = msg
          req.resolve(payload)
        }
      }
    } catch (e) {
      console.warn('Malformed automation message:', e)
    }
  }

  function rejectAllPending(reason: string) {
    for (const [id, req] of pending) {
      clearTimeout(req.timer)
      req.reject(new Error(reason))
      pending.delete(id)
    }
  }

  const wss = new WebSocketServer({ port: AUTOMATION_WS_PORT, host: '127.0.0.1' })

  wss.on('connection', (ws) => {
    if (browserWs && browserWs.readyState === browserWs.OPEN) {
      browserWs.close()
    }
    rejectAllPending('Browser reconnected')
    browserWs = ws
    authToken = null

    ws.on('message', (raw) => {
      handleBrowserMessage(
        typeof raw === 'string' ? raw : Buffer.from(raw as Buffer).toString('utf-8')
      )
    })

    ws.on('close', () => {
      if (browserWs === ws) {
        browserWs = null
        authToken = null
        rejectAllPending('Browser disconnected')
      }
    })
  })

  async function jsxToTree(jsx: string): Promise<unknown> {
    const core = await server.ssrLoadModule('@open-pencil/core')
    const buildComponent = core.buildComponent as (jsx: string) => () => unknown
    const resolveToTree = core.resolveToTree as (el: unknown) => unknown
    const createElement = core.createElement as (type: unknown, props: unknown) => unknown
    const Component = buildComponent(jsx)
    const element = createElement(Component, null)
    return resolveToTree(element)
  }

  async function preprocessRpc(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (body.command !== 'tool') return body
    const args = body.args as { name?: string; args?: Record<string, unknown> } | undefined
    if (args?.name !== 'render' || !args.args?.jsx) return body
    const tree = await jsxToTree(args.args.jsx as string)
    return {
      ...body,
      args: {
        ...args,
        args: { ...args.args, jsx: undefined, tree }
      }
    }
  }

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
    return next()
  })

  app.post('/rpc', async (c) => {
    let body = await c.req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid request body' }, 400)
    }
    try {
      body = await preprocessRpc(body as Record<string, unknown>)
      const result = await sendToBrowser(body as Record<string, unknown>)
      return c.json(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return c.json({ ok: false, error: msg }, 502)
    }
  })

  // MCP Streamable HTTP endpoint — proxies tool calls through WebSocket to the live editor
  type McpTransport = { handleRequest: (r: Request) => Promise<Response> }
  const mcpSessions = new Map<string, McpTransport>()

  async function getOrCreateMcpSession(sessionId?: string): Promise<McpTransport> {
    const cached = sessionId ? mcpSessions.get(sessionId) : undefined
    if (cached) return cached

    const { WebStandardStreamableHTTPServerTransport } =
      await import('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js')
    const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js')
    const { z } = await import('zod')
    const core = await server.ssrLoadModule('@open-pencil/core') as {
      ALL_TOOLS: Array<{ name: string; description: string; params: Record<string, unknown>; mutates?: boolean }>
    }
    const mcp = await server.ssrLoadModule('@open-pencil/mcp') as {
      paramToZod: (p: unknown) => ZodTypeAny
    }

    const id = sessionId ?? crypto.randomUUID()
    const mcpServer = new McpServer({ name: 'open-pencil', version: '0.0.0' })
    const register = mcpServer.registerTool.bind(mcpServer) as (...a: unknown[]) => void

    for (const def of core.ALL_TOOLS) {
      const shape: Record<string, ZodTypeAny> = {}
      for (const [key, param] of Object.entries(def.params)) {
        shape[key] = mcp.paramToZod(param)
      }
      register(def.name, { description: def.description, inputSchema: z.object(shape) },
        async (args: Record<string, unknown>) => {
          try {
            const result = await sendToBrowser({ command: 'tool', args: { name: def.name, args } })
            const res = result as { ok?: boolean; result?: unknown; error?: string }
            if (res.ok === false) {
              return { content: [{ type: 'text' as const, text: JSON.stringify({ error: res.error }) }], isError: true }
            }
            const r = res.result as Record<string, unknown> | undefined
            if (r && 'base64' in r && 'mimeType' in r) {
              return { content: [{ type: 'image' as const, data: r.base64 as string, mimeType: r.mimeType as string }] }
            }
            return { content: [{ type: 'text' as const, text: JSON.stringify(r, null, 2) }] }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true }
          }
        }
      )
    }

    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => id })
    await mcpServer.connect(transport)
    mcpSessions.set(id, transport)
    return transport
  }

  app.all('/mcp', async (c) => {
    const sessionId = c.req.header('mcp-session-id') ?? undefined
    const transport = await getOrCreateMcpSession(sessionId)
    return transport.handleRequest(c.req.raw)
  })

  void startServer(app)

  console.log(`[automation] HTTP  http://127.0.0.1:${AUTOMATION_HTTP_PORT}`)
  console.log(`[automation] WS    ws://127.0.0.1:${AUTOMATION_WS_PORT}`)
  console.log(`[automation] MCP   http://127.0.0.1:${AUTOMATION_HTTP_PORT}/mcp`)
}

function isBunRuntime(): boolean {
  return 'Bun' in globalThis
}

async function startServer(app: Hono) {
  if (isBunRuntime()) {
    ;(globalThis as unknown as { Bun: { serve: (opts: object) => void } }).Bun.serve({
      fetch: app.fetch,
      port: AUTOMATION_HTTP_PORT,
      hostname: '127.0.0.1'
    })
  } else {
    const { serve } = await import('@hono/node-server')
    serve({ fetch: app.fetch, port: AUTOMATION_HTTP_PORT, hostname: '127.0.0.1' })
  }
}
