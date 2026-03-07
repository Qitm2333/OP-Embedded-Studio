import { defineCommand } from 'citty'

import { FigmaAPI } from '@open-pencil/core'

import { loadDocument } from '../headless'
import { isAppMode, requireFile, rpc } from '../app-client'
import { printError } from '../format'

function serializeResult(value: unknown): unknown {
  if (value === undefined || value === null) return value
  if (typeof value === 'object' && value !== null && 'toJSON' in value && typeof value.toJSON === 'function') {
    return value.toJSON()
  }
  if (Array.isArray(value)) return value.map(serializeResult)
  return value
}

export default defineCommand({
  meta: { description: 'Execute JavaScript with Figma plugin API' },
  args: {
    file: { type: 'positional', description: '.fig file path (omit to connect to running app)', required: false },
    code: { type: 'string', alias: 'c', description: 'JavaScript code to execute' },
    stdin: { type: 'boolean', description: 'Read code from stdin' },
    write: { type: 'boolean', alias: 'w', description: 'Write changes back to the input file' },
    output: { type: 'string', alias: 'o', description: 'Write to a different file' },
    json: { type: 'boolean', description: 'Output as JSON' },
    quiet: { type: 'boolean', alias: 'q', description: 'Suppress output' },
  },
  async run({ args }) {
    let code = args.code

    if (args.stdin) {
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
      code = Buffer.concat(chunks).toString('utf-8')
    }

    if (!code) {
      printError('Provide code via --code or --stdin')
      process.exit(1)
    }

    if (isAppMode(args.file)) {
      const result = await rpc<unknown>('eval', { code })
      if (!args.quiet && result !== undefined && result !== null) {
        if (args.json || !process.stdout.isTTY) {
          console.log(JSON.stringify(result, null, 2))
        } else {
          console.log(result)
        }
      }
      return
    }

    const file = requireFile(args.file)
    const graph = await loadDocument(file)
    const figma = new FigmaAPI(graph)

    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const wrappedCode = code.trim().startsWith('return')
      ? code
      : `return (async () => { ${code} })()`

    let result: unknown
    try {
      const fn = new AsyncFunction('figma', wrappedCode)
      result = await fn(figma)
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }

    if (!args.quiet && result !== undefined) {
      const serialized = serializeResult(result)
      if (args.json || !process.stdout.isTTY) {
        console.log(JSON.stringify(serialized, null, 2))
      } else {
        console.log(serialized)
      }
    }

    if (args.write || args.output) {
      const { exportFigFile } = await import('@open-pencil/core')
      const outPath = args.output ?? file
      const data = await exportFigFile(graph)
      await Bun.write(outPath, new Uint8Array(data))
      if (!args.quiet) {
        console.error(`Written to ${outPath}`)
      }
    }
  },
})
