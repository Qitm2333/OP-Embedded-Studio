#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'

import { createServer } from './server.js'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))

const sessions = new Map<string, { server: ReturnType<typeof createServer>; transport: WebStandardStreamableHTTPServerTransport }>()

async function getOrCreateSession(sessionId?: string) {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!
  }

  const id = sessionId ?? randomUUID()
  const server = createServer(pkg.version)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: () => id })
  await server.connect(transport)
  sessions.set(id, { server, transport })
  return { server, transport }
}

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'mcp-session-id', 'Last-Event-ID', 'mcp-protocol-version'],
  exposeHeaders: ['mcp-session-id', 'mcp-protocol-version']
}))

app.get('/health', (c) => c.json({ status: 'ok', version: pkg.version, tools: 29 }))

app.all('/mcp', async (c) => {
  const sessionId = c.req.header('mcp-session-id') ?? undefined
  const { transport } = await getOrCreateSession(sessionId)
  return transport.handleRequest(c.req.raw)
})

const port = parseInt(process.env.PORT ?? '3100', 10)

const isBun = typeof globalThis.Bun !== 'undefined'

if (isBun) {
  Bun.serve({ fetch: app.fetch, port })
} else {
  const { serve } = await import('@hono/node-server')
  serve({ fetch: app.fetch, port })
}

console.log(`OpenPencil MCP server v${pkg.version}`)
console.log(`  Health:  http://localhost:${port}/health`)
console.log(`  MCP:     http://localhost:${port}/mcp`)
