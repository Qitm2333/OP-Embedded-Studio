import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { bold, fmtList, fmtSummary } from '../../format'
import type { SceneNode, SceneGraph } from '@open-pencil/core'

interface ClusterNode {
  id: string
  name: string
  type: string
  width: number
  height: number
  childCount: number
}

interface Cluster {
  signature: string
  nodes: ClusterNode[]
}

function buildSignature(graph: SceneGraph, node: SceneNode): string {
  const childTypes = new Map<string, number>()
  for (const childId of node.childIds) {
    const child = graph.getNode(childId)
    if (!child) continue
    childTypes.set(child.type, (childTypes.get(child.type) ?? 0) + 1)
  }
  const childPart = [...childTypes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([t, c]) => `${t}:${c}`)
    .join(',')

  const w = Math.round(node.width / 10) * 10
  const h = Math.round(node.height / 10) * 10
  return `${node.type}:${w}x${h}|${childPart}`
}

function calcConfidence(nodes: ClusterNode[]): number {
  if (nodes.length < 2) return 100
  const base = nodes[0]!
  let score = 0
  for (const node of nodes.slice(1)) {
    const sizeDiff = Math.abs(node.width - base.width) + Math.abs(node.height - base.height)
    const childDiff = Math.abs(node.childCount - base.childCount)
    if (sizeDiff <= 4 && childDiff === 0) score++
    else if (sizeDiff <= 10 && childDiff <= 1) score += 0.8
    else if (sizeDiff <= 20 && childDiff <= 2) score += 0.6
    else score += 0.4
  }
  return Math.round((score / (nodes.length - 1)) * 100)
}

function formatSignature(sig: string): string {
  const [typeSize, children] = sig.split('|')
  const type = typeSize?.split(':')[0]
  if (!type) return sig
  const typeName = type.charAt(0) + type.slice(1).toLowerCase()
  if (!children) return typeName

  const childParts = children.split(',').map((c) => {
    const [t, count] = c.split(':')
    if (!t) return ''
    const name = t.charAt(0) + t.slice(1).toLowerCase()
    return Number(count) > 1 ? `${name}×${count}` : name
  })

  return `${typeName} > [${childParts.join(', ')}]`
}

function findClusters(
  graph: SceneGraph,
  minSize: number,
  minCount: number
): { clusters: Cluster[]; totalNodes: number } {
  const sigMap = new Map<string, ClusterNode[]>()
  let totalNodes = 0

  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') continue
    totalNodes++
    if (node.width < minSize || node.height < minSize) continue
    if (node.childIds.length === 0) continue

    const sig = buildSignature(graph, node)
    const arr = sigMap.get(sig) ?? []
    arr.push({
      id: node.id,
      name: node.name,
      type: node.type,
      width: Math.round(node.width),
      height: Math.round(node.height),
      childCount: node.childIds.length
    })
    sigMap.set(sig, arr)
  }

  const clusters = [...sigMap.entries()]
    .filter(([, nodes]) => nodes.length >= minCount)
    .map(([signature, nodes]) => ({ signature, nodes }))
    .sort((a, b) => b.nodes.length - a.nodes.length)

  return { clusters, totalNodes }
}

export default defineCommand({
  meta: { description: 'Find repeated design patterns (potential components)' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    limit: { type: 'string', description: 'Max clusters to show', default: '20' },
    'min-size': { type: 'string', description: 'Min node size in px', default: '30' },
    'min-count': { type: 'string', description: 'Min instances to form cluster', default: '2' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)
    const limit = Number(args.limit)
    const minSize = Number(args['min-size'])
    const minCount = Number(args['min-count'])
    const { clusters, totalNodes } = findClusters(graph, minSize, minCount)

    if (args.json) {
      console.log(JSON.stringify({ clusters: clusters.slice(0, limit), totalNodes }, null, 2))
      return
    }

    if (clusters.length === 0) {
      console.log('No repeated patterns found.')
      return
    }

    console.log('')
    console.log(bold('  Repeated patterns'))
    console.log('')

    const items = clusters.slice(0, limit).map((c) => {
      const first = c.nodes[0]!
      const confidence = calcConfidence(c.nodes)

      const widths = c.nodes.map((n) => n.width)
      const heights = c.nodes.map((n) => n.height)
      const wRange = Math.max(...widths) - Math.min(...widths)
      const hRange = Math.max(...heights) - Math.min(...heights)
      const avgW = Math.round(widths.reduce((a, b) => a + b, 0) / widths.length)
      const avgH = Math.round(heights.reduce((a, b) => a + b, 0) / heights.length)

      const sizeStr =
        wRange <= 4 && hRange <= 4
          ? `${avgW}×${avgH}`
          : `${avgW}×${avgH} (±${Math.max(wRange, hRange)}px)`

      return {
        header: `${c.nodes.length}× ${first.type.toLowerCase()} "${first.name}" (${confidence}% match)`,
        details: {
          size: sizeStr,
          structure: formatSignature(c.signature),
          examples: c.nodes.slice(0, 3).map((n) => n.id).join(', ')
        }
      }
    })

    console.log(fmtList(items, { numbered: true }))

    const clusteredNodes = clusters.reduce((sum, c) => sum + c.nodes.length, 0)
    console.log('')
    console.log(
      fmtSummary({ clusters: clusters.length }) +
        ` from ${totalNodes} nodes (${clusteredNodes} clustered)`
    )
    console.log('')
  }
})
