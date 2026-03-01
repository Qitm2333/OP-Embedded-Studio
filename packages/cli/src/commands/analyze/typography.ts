import { defineCommand } from 'citty'

import { loadDocument } from '../../headless'
import { bold, fmtHistogram, fmtSummary } from '../../format'
import type { SceneGraph } from '@open-pencil/core'

interface TypographyStyle {
  family: string
  size: number
  weight: number
  lineHeight: string
  count: number
}

function collectTypography(graph: SceneGraph): { styles: TypographyStyle[]; totalTextNodes: number } {
  const styleMap = new Map<string, TypographyStyle>()
  let totalTextNodes = 0

  for (const node of graph.getAllNodes()) {
    if (node.type !== 'TEXT') continue
    totalTextNodes++

    const lh = node.lineHeight === null ? 'auto' : `${node.lineHeight}px`
    const key = `${node.fontFamily}|${node.fontSize}|${node.fontWeight}|${lh}`

    const existing = styleMap.get(key)
    if (existing) {
      existing.count++
    } else {
      styleMap.set(key, {
        family: node.fontFamily,
        size: node.fontSize,
        weight: node.fontWeight,
        lineHeight: lh,
        count: 1
      })
    }
  }

  return { styles: [...styleMap.values()], totalTextNodes }
}

function weightName(w: number): string {
  if (w <= 100) return 'Thin'
  if (w <= 200) return 'ExtraLight'
  if (w <= 300) return 'Light'
  if (w <= 400) return 'Regular'
  if (w <= 500) return 'Medium'
  if (w <= 600) return 'SemiBold'
  if (w <= 700) return 'Bold'
  if (w <= 800) return 'ExtraBold'
  return 'Black'
}

export default defineCommand({
  meta: { description: 'Analyze typography usage' },
  args: {
    file: { type: 'positional', description: '.fig file path', required: true },
    'group-by': {
      type: 'string',
      description: 'Group by: family, size, weight (default: show all styles)'
    },
    limit: { type: 'string', description: 'Max styles to show', default: '30' },
    json: { type: 'boolean', description: 'Output as JSON' }
  },
  async run({ args }) {
    const graph = await loadDocument(args.file)
    const limit = Number(args.limit)
    const groupBy = args['group-by']
    const { styles, totalTextNodes } = collectTypography(graph)

    if (args.json) {
      console.log(JSON.stringify({ styles, totalTextNodes }, null, 2))
      return
    }

    if (styles.length === 0) {
      console.log('No text nodes found.')
      return
    }

    const sorted = styles.sort((a, b) => b.count - a.count)

    console.log('')

    if (groupBy === 'family') {
      const byFamily = new Map<string, number>()
      for (const s of sorted) byFamily.set(s.family, (byFamily.get(s.family) ?? 0) + s.count)
      console.log(bold('  Font families'))
      console.log('')
      console.log(
        fmtHistogram(
          [...byFamily.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([family, count]) => ({ label: family, value: count }))
        )
      )
    } else if (groupBy === 'size') {
      const bySize = new Map<number, number>()
      for (const s of sorted) bySize.set(s.size, (bySize.get(s.size) ?? 0) + s.count)
      console.log(bold('  Font sizes'))
      console.log('')
      console.log(
        fmtHistogram(
          [...bySize.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([size, count]) => ({ label: `${size}px`, value: count }))
        )
      )
    } else if (groupBy === 'weight') {
      const byWeight = new Map<number, number>()
      for (const s of sorted) byWeight.set(s.weight, (byWeight.get(s.weight) ?? 0) + s.count)
      console.log(bold('  Font weights'))
      console.log('')
      console.log(
        fmtHistogram(
          [...byWeight.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([weight, count]) => ({ label: `${weight} ${weightName(weight)}`, value: count }))
        )
      )
    } else {
      console.log(bold('  Typography styles'))
      console.log('')
      const items = sorted.slice(0, limit).map((s) => {
        const lh = s.lineHeight !== 'auto' ? ` / ${s.lineHeight}` : ''
        return {
          label: `${s.family} ${s.size}px ${weightName(s.weight)}${lh}`,
          value: s.count
        }
      })
      console.log(fmtHistogram(items))
    }

    console.log('')
    console.log(fmtSummary({ 'unique styles': styles.length }) + ` from ${totalTextNodes} text nodes`)
    console.log('')
  }
})
