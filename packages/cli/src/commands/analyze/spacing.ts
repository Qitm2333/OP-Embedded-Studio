import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { bold, kv, fmtHistogram, fmtSummary } from '../../format'
import type { SceneGraph } from '@open-pencil/core'

interface SpacingValue {
  value: number
  count: number
}

function collectSpacing(graph: SceneGraph): {
  gaps: SpacingValue[]
  paddings: SpacingValue[]
  totalNodes: number
} {
  const gapMap = new Map<number, number>()
  const paddingMap = new Map<number, number>()
  let totalNodes = 0

  for (const node of graph.getAllNodes()) {
    if (node.type === 'CANVAS') continue
    if (node.layoutMode === 'NONE') continue
    totalNodes++

    if (node.itemSpacing > 0) {
      gapMap.set(node.itemSpacing, (gapMap.get(node.itemSpacing) ?? 0) + 1)
    }
    if (node.counterAxisSpacing > 0) {
      gapMap.set(node.counterAxisSpacing, (gapMap.get(node.counterAxisSpacing) ?? 0) + 1)
    }

    for (const pad of [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft]) {
      if (pad > 0) paddingMap.set(pad, (paddingMap.get(pad) ?? 0) + 1)
    }
  }

  const toValues = (map: Map<number, number>) =>
    [...map.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)

  return { gaps: toValues(gapMap), paddings: toValues(paddingMap), totalNodes }
}

export default defineCommand({
  meta: { description: 'Analyze spacing values (gap, padding)' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    grid: { type: 'string', description: 'Base grid size to check against', default: '8' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)
    const gridSize = Number(args.grid)
    const { gaps, paddings, totalNodes } = collectSpacing(graph)

    if (args.json) {
      console.log(JSON.stringify({ gaps, paddings, totalNodes }, null, 2))
      return
    }

    console.log('')

    if (gaps.length > 0) {
      console.log(bold('  Gap values'))
      console.log('')
      console.log(
        fmtHistogram(
          gaps.slice(0, 15).map((g) => ({
            label: `${String(g.value).padStart(4)}px`,
            value: g.count,
            suffix: g.value % gridSize !== 0 ? '⚠' : undefined
          }))
        )
      )
      console.log('')
    }

    if (paddings.length > 0) {
      console.log(bold('  Padding values'))
      console.log('')
      console.log(
        fmtHistogram(
          paddings.slice(0, 15).map((p) => ({
            label: `${String(p.value).padStart(4)}px`,
            value: p.count,
            suffix: p.value % gridSize !== 0 ? '⚠' : undefined
          }))
        )
      )
      console.log('')
    }

    if (gaps.length === 0 && paddings.length === 0) {
      console.log('No auto-layout nodes with spacing found.')
      console.log('')
      return
    }

    console.log(fmtSummary({ 'gap values': gaps.length, 'padding values': paddings.length }))

    const offGridGaps = gaps.filter((g) => g.value % gridSize !== 0)
    const offGridPaddings = paddings.filter((p) => p.value % gridSize !== 0)

    if (offGridGaps.length > 0 || offGridPaddings.length > 0) {
      console.log('')
      console.log(bold(`  ⚠ Off-grid values (not ÷${gridSize}px)`))
      if (offGridGaps.length > 0) {
        console.log(kv('Gaps', offGridGaps.map((g) => `${g.value}px`).join(', ')))
      }
      if (offGridPaddings.length > 0) {
        console.log(kv('Paddings', offGridPaddings.map((p) => `${p.value}px`).join(', ')))
      }
    }

    console.log('')
  }
})
