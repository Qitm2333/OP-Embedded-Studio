import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { bold, fmtHistogram, fmtList, fmtSummary } from '../../format'
import type { SceneGraph } from '@open-pencil/core'

interface ColorInfo {
  hex: string
  count: number
  variableName: string | null
}

function toHex(r: number, g: number, b: number): string {
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ]
}

function colorDistance(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1)
  const [r2, g2, b2] = hexToRgb(hex2)
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

interface Cluster {
  colors: ColorInfo[]
  suggestedHex: string
  totalCount: number
}

function clusterColors(colors: ColorInfo[], threshold: number): Cluster[] {
  const clusters: Cluster[] = []
  const used = new Set<string>()
  const sorted = [...colors].sort((a, b) => b.count - a.count)

  for (const color of sorted) {
    if (used.has(color.hex)) continue

    const cluster: Cluster = {
      colors: [color],
      suggestedHex: color.hex,
      totalCount: color.count
    }
    used.add(color.hex)

    for (const other of sorted) {
      if (used.has(other.hex)) continue
      if (colorDistance(color.hex, other.hex) <= threshold) {
        cluster.colors.push(other)
        cluster.totalCount += other.count
        used.add(other.hex)
      }
    }

    if (cluster.colors.length > 1) clusters.push(cluster)
  }

  return clusters.sort((a, b) => b.colors.length - a.colors.length)
}

function collectColors(graph: SceneGraph): { colors: ColorInfo[]; totalNodes: number } {
  const colorMap = new Map<string, ColorInfo>()
  let totalNodes = 0

  const addColor = (hex: string, variableName: string | null) => {
    const existing = colorMap.get(hex)
    if (existing) {
      existing.count++
      if (variableName && !existing.variableName) existing.variableName = variableName
    } else {
      colorMap.set(hex, { hex, count: 1, variableName })
    }
  }

  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') continue
    totalNodes++

    for (const fill of node.fills) {
      if (!fill.visible || fill.type !== 'SOLID') continue
      const hex = toHex(fill.color.r, fill.color.g, fill.color.b)
      addColor(hex, null)
    }

    for (const stroke of node.strokes) {
      if (!stroke.visible) continue
      const hex = toHex(stroke.color.r, stroke.color.g, stroke.color.b)
      addColor(hex, null)
    }

    for (const effect of node.effects) {
      if (!effect.visible) continue
      const hex = toHex(effect.color.r, effect.color.g, effect.color.b)
      addColor(hex, null)
    }

    for (const [field, varId] of Object.entries(node.boundVariables)) {
      if (!field.includes('fill') && !field.includes('stroke') && !field.includes('color'))
        continue
      const variable = graph.variables.get(varId)
      if (variable) {
        const resolvedColor = graph.resolveColorVariable(varId)
        if (resolvedColor) {
          const hex = toHex(resolvedColor.r, resolvedColor.g, resolvedColor.b)
          const existing = colorMap.get(hex)
          if (existing) existing.variableName = variable.name
        }
      }
    }
  }

  return { colors: [...colorMap.values()], totalNodes }
}

export default defineCommand({
  meta: { description: 'Analyze color palette usage' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    limit: { type: 'string', description: 'Max colors to show', default: '30' },
    threshold: {
      type: 'string',
      description: 'Distance threshold for clustering similar colors (0–50)',
      default: '15'
    },
    similar: { type: 'boolean', description: 'Show similar color clusters' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)
    const limit = Number(args.limit)
    const threshold = Number(args.threshold)
    const { colors, totalNodes } = collectColors(graph)

    if (args.json) {
      const clusters = args.similar ? clusterColors(colors, threshold) : []
      console.log(JSON.stringify({ colors, totalNodes, clusters }, null, 2))
      return
    }

    if (colors.length === 0) {
      console.log('No colors found.')
      return
    }

    const sorted = colors.sort((a, b) => b.count - a.count).slice(0, limit)

    console.log('')
    console.log(bold('  Colors by usage'))
    console.log('')
    console.log(
      fmtHistogram(
        sorted.map((c) => ({
          label: c.hex,
          value: c.count,
          tag: c.variableName ? `$${c.variableName}` : undefined
        }))
      )
    )

    const hardcoded = colors.filter((c) => !c.variableName)
    const fromVars = colors.filter((c) => c.variableName)

    console.log('')
    console.log(
      fmtSummary({ 'unique colors': colors.length, 'from variables': fromVars.length, hardcoded: hardcoded.length })
    )

    if (args.similar) {
      const clusters = clusterColors(hardcoded, threshold)
      if (clusters.length > 0) {
        console.log('')
        console.log(bold('  Similar colors (consider merging)'))
        console.log('')
        console.log(
          fmtList(
            clusters.slice(0, 10).map((cluster) => ({
              header: cluster.colors.map((c) => c.hex).join(', '),
              details: { suggest: cluster.suggestedHex, total: `${cluster.totalCount}×` }
            }))
          )
        )
      }
    }

    console.log('')
  }
})
