/**
 * Browser-side automation handler.
 *
 * Connects to the bridge via WebSocket, receives RPC requests,
 * executes them against the live EditorStore, and sends results back.
 */
import { ALL_TOOLS, AUTOMATION_WS_PORT, FigmaAPI, executeRpcCommand, renderTreeNode, computeAllLayouts } from '@open-pencil/core'

import type { EditorStore } from '@/stores/editor'
import type { ExportFormat } from '@open-pencil/core'

const TOKEN_LENGTH = 32

function generateToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function connectAutomation(getStore: () => EditorStore) {
  const token = generateToken()
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined

  function makeFigma(): FigmaAPI {
    const store = getStore()
    const api = new FigmaAPI(store.graph)
    api.currentPage = api.wrapNode(store.state.currentPageId)
    api.currentPage.selection = [...store.state.selectedIds]
      .map((id) => api.getNodeById(id))
      .filter((n): n is NonNullable<typeof n> => n !== null)
    api.viewport = {
      center: {
        x: (-store.state.panX + window.innerWidth / 2) / store.state.zoom,
        y: (-store.state.panY + window.innerHeight / 2) / store.state.zoom
      },
      zoom: store.state.zoom
    }
    api.exportImage = (nodeIds, opts) =>
      store.renderExportImage(nodeIds, opts.scale ?? 1, (opts.format ?? 'PNG') as ExportFormat)
    return api
  }

  async function handleRequest(_id: string, command: string, args: unknown): Promise<unknown> {
    const store = getStore()

    if (command === 'eval') {
      const code = (args as { code?: string })?.code
      if (!code) throw new Error('Missing "code" in args')
      const figma = makeFigma()
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
      const wrappedCode = code.trim().startsWith('return')
        ? code
        : `return (async () => { ${code} })()`
      const fn = new AsyncFunction('figma', wrappedCode)
      const result = await fn(figma)
      store.requestRender()
      return { ok: true, result: result ?? null }
    }

    if (command === 'tool') {
      const toolName = (args as { name?: string })?.name
      const toolArgs = (args as { args?: Record<string, unknown> })?.args ?? {}
      if (!toolName) throw new Error('Missing "name" in args')

      if (toolName === 'render' && toolArgs.tree) {
        const tree = toolArgs.tree as Parameters<typeof renderTreeNode>[1]
        const result = renderTreeNode(store.graph, tree, {
          parentId: (toolArgs.parent_id as string) ?? store.state.currentPageId,
          x: toolArgs.x as number | undefined,
          y: toolArgs.y as number | undefined
        })
        computeAllLayouts(store.graph, store.state.currentPageId)
        store.requestRender()
        store.flashNodes([result.id])
        return { ok: true, result: { id: result.id, name: result.name, type: result.type, children: result.childIds } }
      }

      const def = ALL_TOOLS.find((t) => t.name === toolName)
      if (!def) throw new Error(`Unknown tool: ${toolName}`)
      const figma = makeFigma()
      const result = await def.execute(figma, toolArgs)
      if (def.mutates) {
        computeAllLayouts(store.graph, store.state.currentPageId)
        store.requestRender()
        store.flashNodes(extractNodeIds(result))
      }
      return { ok: true, result }
    }

    if (command === 'export') {
      const exportArgs = args as { nodeIds?: string[]; scale?: number; format?: string } | undefined
      const nodeIds = exportArgs?.nodeIds ?? [...store.state.selectedIds]
      if (nodeIds.length === 0) throw new Error('No nodes to export')
      const data = await store.renderExportImage(
        nodeIds,
        exportArgs?.scale ?? 1,
        (exportArgs?.format ?? 'PNG') as ExportFormat
      )
      if (!data) throw new Error('Export failed')
      const base64 = btoa(String.fromCharCode(...data))
      return { ok: true, base64, mimeType: `image/${(exportArgs?.format ?? 'png').toLowerCase()}` }
    }

    const result = executeRpcCommand(store.graph, command, args ?? {})
    return { ok: true, result }
  }

  function connect() {
    try {
      ws = new WebSocket(`ws://127.0.0.1:${AUTOMATION_WS_PORT}`)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: 'register', token }))
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data) as {
          type: string
          id: string
          command: string
          args?: unknown
        }
        if (msg.type !== 'request' || !msg.id) return
        try {
          const result = await handleRequest(msg.id, msg.command, msg.args)
          ws?.send(JSON.stringify({ type: 'response', id: msg.id, ...(result as object) }))
        } catch (e) {
          ws?.send(
            JSON.stringify({
              type: 'response',
              id: msg.id,
              ok: false,
              error: e instanceof Error ? e.message : String(e)
            })
          )
        }
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      ws = null
      scheduleReconnect()
    }

    ws.onerror = () => {
      ws?.close()
    }
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 2000)
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    ws?.close()
    ws = null
  }

  connect()
  return { disconnect, token }
}

function extractNodeIds(result: unknown): string[] {
  if (!result || typeof result !== 'object') return []
  const obj = result as Record<string, unknown>
  if (typeof obj.deleted === 'string') return []
  const ids: string[] = []
  if (typeof obj.id === 'string') ids.push(obj.id)
  if (Array.isArray(obj.results)) {
    for (const item of obj.results) {
      if (
        item &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string'
      )
        ids.push((item as Record<string, unknown>).id as string)
    }
  }
  return ids
}
