import { defineCommand } from 'citty'

import { loadDocument } from '../headless'
import { fmtNode, fmtList, nodeToData, nodeDetails, formatType, printError } from '../format'
import type { SceneNode, SceneGraph } from '@open-pencil/core'

function fullNodeDetails(graph: SceneGraph, node: SceneNode): Record<string, unknown> {
  const details = nodeDetails(node)

  const parent = node.parentId ? graph.getNode(node.parentId) : undefined
  if (parent) details.parent = `${parent.name} (${parent.id})`

  if (node.text) {
    details.text = node.text.length > 80 ? node.text.slice(0, 80) + '…' : node.text
  }

  if (node.childIds.length > 0) details.children = node.childIds.length

  for (const [field, varId] of Object.entries(node.boundVariables)) {
    const variable = graph.variables.get(varId)
    details[`var:${field}`] = variable?.name ?? varId
  }

  return details
}

export default defineCommand({
  meta: { description: 'Show detailed node properties by ID' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    id: { type: 'string', description: 'Node ID', required: true },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)
    const node = graph.getNode(args.id)

    if (!node) {
      printError(`Node "${args.id}" not found.`)
      process.exit(1)
    }

    if (args.json) {
      const { childIds, parentId, ...rest } = node
      const children = childIds.length
      const parent = parentId ? graph.getNode(parentId) : undefined
      console.log(
        JSON.stringify(
          {
            ...rest,
            parent: parent ? { id: parent.id, name: parent.name, type: parent.type } : null,
            children
          },
          null,
          2
        )
      )
      return
    }

    console.log('')
    console.log(fmtNode(nodeToData(node), fullNodeDetails(graph, node)))

    if (node.childIds.length > 0) {
      const children = node.childIds
        .map((id) => graph.getNode(id))
        .filter((n): n is SceneNode => n !== undefined)
        .slice(0, 10)
        .map((child) => ({
          header: `[${formatType(child.type)}] "${child.name}" (${child.id})`
        }))

      if (node.childIds.length > 10) {
        children.push({ header: `… and ${node.childIds.length - 10} more` })
      }

      console.log('')
      console.log(fmtList(children, { compact: true }))
    }

    console.log('')
  }
})
