/**
 * Compare .fig import against Figma ground truth.
 *
 * Node IDs differ between .fig import and Figma Plugin API, so we match
 * nodes by tree path: sequence of (name, sibling_index) from root to leaf.
 *
 * Truth: tests/fixtures/gold-preview-truth.json (extracted from live Figma).
 */
import { readFigFile } from './packages/core/src/kiwi/fig-file'
import { FigmaAPI } from './packages/core/src/figma-api'

const fixturePath = process.argv[2] || 'tests/fixtures/gold-preview.fig'
const truthPath = 'tests/fixtures/gold-preview-truth.json'

interface TruthNode {
  path: string
  name: string
  type: string
  visible: boolean
  width: number
  height: number
  text?: string
  fill?: string
  cr?: number
  clip?: boolean
}

function colorHex(c: { r: number; g: number; b: number; a: number }): string {
  const r = Math.round(c.r * 255)
  const g = Math.round(c.g * 255)
  const b = Math.round(c.b * 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

const truth: TruthNode[] = JSON.parse(await Bun.file(truthPath).text())
const truthMap = new Map(truth.map(n => [n.path, n]))

const file = Bun.file(fixturePath)
const graph = await readFigFile(new File([await file.arrayBuffer()], 'gold-preview.fig'))

const api = new FigmaAPI(graph)
const page = api.root.children[0]
if (!page) { console.error('No page found'); process.exit(1) }

const ourNodes = new Map<string, TruthNode>()

function collect(proxy: ReturnType<FigmaAPI['wrapNode']>, parentPath: string, sibIdx: number, sibNames: Map<string, number>) {
  // Use name-based index when all sibling names are unique, numeric index otherwise
  const nameCount = sibNames.get(proxy.name) ?? 0
  sibNames.set(proxy.name, nameCount + 1)
  const path = `${parentPath}/${proxy.name}[${nameCount}]`
  const raw = (proxy as unknown as { _raw(): Record<string, unknown> })._raw()
  const fills = raw.fills as Array<{ type: string; color: { r: number; g: number; b: number; a: number }; visible: boolean }> | undefined
  const visibleFill = fills?.find(f => f.type === 'SOLID' && f.visible !== false)

  const entry: TruthNode = {
    path,
    name: proxy.name,
    type: proxy.type,
    visible: (proxy as unknown as { visible: boolean }).visible,
    width: Math.round((raw.width as number) * 100) / 100,
    height: Math.round((raw.height as number) * 100) / 100,
  }
  const chars = (proxy as unknown as { characters?: string }).characters
  if (proxy.type === 'TEXT' && chars) entry.text = chars
  if (visibleFill) entry.fill = colorHex(visibleFill.color)
  let cr = raw.cornerRadius as number
  if (raw.independentCorners) {
    const tl = raw.topLeftRadius as number ?? 0
    const tr = raw.topRightRadius as number ?? 0
    const br = raw.bottomRightRadius as number ?? 0
    const bl = raw.bottomLeftRadius as number ?? 0
    if (tl === tr && tr === br && br === bl) cr = tl
    else cr = Math.max(tl, tr, br, bl)
  }
  if (cr > 0) entry.cr = Math.round(cr * 10) / 10
  if (raw.clipsContent) entry.clip = true

  ourNodes.set(path, entry)
  const children = (proxy as unknown as { children?: unknown[] }).children
  if (children) {
    const childNames = new Map<string, number>()
    for (let i = 0; i < children.length; i++) {
      collect(children[i] as ReturnType<FigmaAPI['wrapNode']>, path, i, childNames)
    }
  }
}

const pageChildren = (api.wrapNode(page.id) as unknown as { children?: unknown[] }).children ?? []
const topNames = new Map<string, number>()
for (let i = 0; i < pageChildren.length; i++) {
  collect(pageChildren[i] as ReturnType<FigmaAPI['wrapNode']>, '', i, topNames)
}

let diffs = 0, visibility = 0, text = 0, fills = 0, radius = 0, size = 0, matched = 0

for (const [path, t] of truthMap) {
  const o = ourNodes.get(path)
  if (!o) continue
  matched++

  if (o.visible !== t.visible) { visibility++; diffs++ }
  if (t.text && o.text !== t.text) { text++; diffs++ }
  if (t.fill && o.fill && t.fill.toLowerCase() !== o.fill.toLowerCase()) { fills++; diffs++ }
  if (t.cr && t.cr > 0) {
    const oCr = o.cr ?? 0
    // Both >= half the smaller dimension = fully rounded (pill), treat as equal
    const minDim = Math.min(t.width, t.height)
    const bothPill = oCr >= minDim / 2 && t.cr >= minDim / 2
    if (!bothPill && Math.abs(oCr - t.cr) > 1) { radius++; diffs++ }
  }
  if (t.visible && o.visible && (Math.abs(o.width - t.width) > 1 || Math.abs(o.height - t.height) > 1)) {
    size++; diffs++
  }
}

const unmatched = truth.length - matched

console.log(`METRIC total_diffs=${diffs}`)
console.log(`METRIC visibility=${visibility}`)
console.log(`METRIC text=${text}`)
console.log(`METRIC fills=${fills}`)
console.log(`METRIC radius=${radius}`)
console.log(`METRIC size=${size}`)
console.log(`METRIC unmatched=${unmatched}`)
