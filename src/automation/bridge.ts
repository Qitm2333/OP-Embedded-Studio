import { serve } from '@hono/node-server'
import { startServer } from '@open-pencil/mcp'

const { app, httpPort } = startServer()

serve({ fetch: app.fetch, port: httpPort, hostname: '127.0.0.1' })
