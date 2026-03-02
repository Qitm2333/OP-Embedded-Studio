import { readFile, writeFile } from 'node:fs/promises'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { ALL_TOOLS, FigmaAPI, parseFigFile, computeAllLayouts, SceneGraph } from '@open-pencil/core'

import type { ToolDef, ParamDef, ParamType } from '@open-pencil/core'

type McpResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

function ok(data: unknown): McpResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function fail(e: unknown): McpResult {
  const msg = e instanceof Error ? e.message : String(e)
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }) }], isError: true }
}

function paramToZod(param: ParamDef): z.ZodTypeAny {
  const typeMap: Record<ParamType, () => z.ZodTypeAny> = {
    string: () =>
      param.enum
        ? z.enum(param.enum as [string, ...string[]]).describe(param.description)
        : z.string().describe(param.description),
    number: () => {
      let s = z.number()
      if (param.min !== undefined) s = s.min(param.min)
      if (param.max !== undefined) s = s.max(param.max)
      return s.describe(param.description)
    },
    boolean: () => z.boolean().describe(param.description),
    color: () => z.string().describe(param.description),
    'string[]': () => z.array(z.string()).min(1).describe(param.description)
  }

  const schema = typeMap[param.type]()
  return param.required ? schema : schema.optional()
}

export function createServer(version: string): McpServer {
  const server = new McpServer({ name: 'open-pencil', version })

  let graph: SceneGraph | null = null
  let currentPageId: string | null = null

  function makeFigma(): FigmaAPI {
    if (!graph) throw new Error('No document loaded. Use open_file or new_document first.')
    const api = new FigmaAPI(graph)
    if (currentPageId) api.currentPage = api.wrapNode(currentPageId)
    return api
  }

  function registerTool(def: ToolDef) {
    const shape: Record<string, z.ZodTypeAny> = {}
    for (const [key, param] of Object.entries(def.params)) {
      shape[key] = paramToZod(param)
    }

    server.registerTool(def.name, { description: def.description, inputSchema: z.object(shape) }, async (args) => {
      try {
        const result = await def.execute(makeFigma(), args as Record<string, unknown>)
        return ok(result)
      } catch (e) {
        return fail(e)
      }
    })
  }

  server.registerTool(
    'open_file',
    {
      description: 'Open a .fig file for editing. Must be called before using other tools.',
      inputSchema: z.object({ path: z.string().describe('Absolute path to a .fig file') })
    },
    async ({ path: filePath }) => {
      try {
        const buf = await readFile(filePath)
        graph = await parseFigFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
        computeAllLayouts(graph)
        const pages = graph.getPages()
        currentPageId = pages[0]?.id ?? null
        return ok({ pages: pages.map((p) => ({ id: p.id, name: p.name })), currentPage: pages[0]?.name })
      } catch (e) {
        return fail(e)
      }
    }
  )

  server.registerTool(
    'save_file',
    {
      description: 'Save the current document to a .fig file.',
      inputSchema: z.object({ path: z.string().describe('Absolute path to save the .fig file') })
    },
    async ({ path: filePath }) => {
      try {
        if (!graph) throw new Error('No document loaded')
        const { exportFigFile } = await import('@open-pencil/core')
        const data = await exportFigFile(graph)
        await writeFile(filePath, new Uint8Array(data))
        return ok({ saved: filePath, bytes: data.byteLength })
      } catch (e) {
        return fail(e)
      }
    }
  )

  server.registerTool(
    'new_document',
    {
      description: 'Create a new empty document with a blank page.',
      inputSchema: z.object({})
    },
    async () => {
      try {
        graph = new SceneGraph()
        const pages = graph.getPages()
        currentPageId = pages[0]?.id ?? null
        return ok({ page: pages[0]?.name, id: currentPageId })
      } catch (e) {
        return fail(e)
      }
    }
  )

  for (const tool of ALL_TOOLS) {
    registerTool(tool)
  }

  return server
}
