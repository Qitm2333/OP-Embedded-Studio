import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { bold, fmtList, fmtSummary } from '../format'
import type { SceneGraph, Variable } from '@open-pencil/core'

function formatValue(variable: Variable, graph: SceneGraph): string {
  const modeId = graph.getActiveModeId(variable.collectionId)
  const raw = variable.valuesByMode[modeId]
  if (raw === undefined) return '–'

  if (typeof raw === 'object' && raw !== null && 'aliasId' in raw) {
    const alias = graph.variables.get(raw.aliasId)
    return alias ? `→ ${alias.name}` : `→ ${raw.aliasId}`
  }

  if (typeof raw === 'object' && 'r' in raw) {
    const { r, g, b } = raw as { r: number; g: number; b: number }
    return (
      '#' +
      [r, g, b]
        .map((c) =>
          Math.round(c * 255)
            .toString(16)
            .padStart(2, '0')
        )
        .join('')
    )
  }

  return String(raw)
}

export default defineCommand({
  meta: { description: 'List design variables and collections' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    collection: { type: 'string', description: 'Filter by collection name' },
    type: { type: 'string', description: 'Filter by type: COLOR, FLOAT, STRING, BOOLEAN' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)

    const collections = [...graph.variableCollections.values()]
    const variables = [...graph.variables.values()]

    if (variables.length === 0) {
      console.log('No variables found.')
      return
    }

    if (args.json) {
      console.log(JSON.stringify({ collections, variables }, null, 2))
      return
    }

    const typeFilter = args.type?.toUpperCase()
    const collFilter = args.collection?.toLowerCase()

    console.log('')

    for (const coll of collections) {
      if (collFilter && !coll.name.toLowerCase().includes(collFilter)) continue

      const collVars = graph
        .getVariablesForCollection(coll.id)
        .filter((v) => !typeFilter || v.type === typeFilter)

      if (collVars.length === 0) continue

      const modes = coll.modes.map((m) => m.name).join(', ')
      console.log(bold(`  ${coll.name}`) + ` (${modes})`)
      console.log('')
      console.log(
        fmtList(
          collVars.map((v) => ({
            header: v.name,
            details: { value: formatValue(v, graph), type: v.type.toLowerCase() }
          })),
          { compact: true }
        )
      )
      console.log('')
    }

    console.log(
      fmtSummary({
        variables: variables.length,
        collections: collections.length
      })
    )
    console.log('')
  }
})
