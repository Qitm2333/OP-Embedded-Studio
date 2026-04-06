import { iconToSVG } from '@iconify/utils'
import svgpath from 'svgpath'

import { parseSVGPath } from '../io/formats/svg/parse-path'

import type { VectorNetwork, WindingRule } from '../scene-graph'

const ICONIFY_API = 'https://api.iconify.design'
const FETCH_TIMEOUT_MS = 10_000

interface PathInfo {
  d: string
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
  fillRule: WindingRule
}

export interface IconPath {
  vectorNetwork: VectorNetwork
  fill: string | null
  stroke: string | null
  strokeWidth: number
  strokeCap: string
  strokeJoin: string
}

export interface IconData {
  prefix: string
  name: string
  width: number
  height: number
  paths: IconPath[]
}

interface IconifyIconEntry {
  body: string
  width?: number
  height?: number
}

interface IconifyResponse {
  prefix: string
  width?: number
  height?: number
  icons: { [key: string]: IconifyIconEntry | undefined }
  aliases?: { [key: string]: { parent: string } | undefined }
}

const iconCache = new Map<string, IconData>()

export function clearIconCache(): void {
  iconCache.clear()
}

function parseIconName(name: string): { prefix: string; iconName: string } {
  const colonIdx = name.indexOf(':')
  if (colonIdx === -1) {
    throw new Error(
      `Invalid icon name "${name}". Use prefix:name format (e.g. lucide:heart, mdi:home)`
    )
  }
  return { prefix: name.slice(0, colonIdx), iconName: name.slice(colonIdx + 1) }
}

function attrValue(tag: string, attr: string): string | null {
  const re = new RegExp(`\\b${attr}="([^"]*)"`)
  const m = tag.match(re)
  return m ? m[1] : null
}

function num(tag: string, attr: string, fallback = 0): number {
  const v = attrValue(tag, attr)
  return v !== null ? parseFloat(v) : fallback
}

function shapeToD(tagName: string, tag: string): string | null {
  switch (tagName) {
    case 'circle': {
      const cx = num(tag, 'cx'),
        cy = num(tag, 'cy'),
        r = num(tag, 'r')
      return r > 0
        ? `M${cx - r},${cy}A${r},${r},0,1,0,${cx + r},${cy}A${r},${r},0,1,0,${cx - r},${cy}Z`
        : null
    }
    case 'ellipse': {
      const cx = num(tag, 'cx'),
        cy = num(tag, 'cy'),
        rx = num(tag, 'rx'),
        ry = num(tag, 'ry')
      return rx > 0 && ry > 0
        ? `M${cx - rx},${cy}A${rx},${ry},0,1,0,${cx + rx},${cy}A${rx},${ry},0,1,0,${cx - rx},${cy}Z`
        : null
    }
    case 'rect': {
      const x = num(tag, 'x'),
        y = num(tag, 'y'),
        w = num(tag, 'width'),
        h = num(tag, 'height')
      if (w <= 0 || h <= 0) return null
      const rx = Math.min(num(tag, 'rx'), w / 2),
        ry = Math.min(num(tag, 'ry', rx), h / 2)
      if (rx > 0 || ry > 0) {
        const arx = rx || ry,
          ary = ry || rx
        return `M${x + arx},${y}H${x + w - arx}A${arx},${ary},0,0,1,${x + w},${y + ary}V${y + h - ary}A${arx},${ary},0,0,1,${x + w - arx},${y + h}H${x + arx}A${arx},${ary},0,0,1,${x},${y + h - ary}V${y + ary}A${arx},${ary},0,0,1,${x + arx},${y}Z`
      }
      return `M${x},${y}H${x + w}V${y + h}H${x}Z`
    }
    case 'line': {
      const x1 = num(tag, 'x1'),
        y1 = num(tag, 'y1'),
        x2 = num(tag, 'x2'),
        y2 = num(tag, 'y2')
      return `M${x1},${y1}L${x2},${y2}`
    }
    case 'polygon':
    case 'polyline': {
      const points = attrValue(tag, 'points')
      if (!points) return null
      const nums = points
        .trim()
        .split(/[\s,]+/)
        .map(Number)
      if (nums.length < 4) return null
      let d = `M${nums[0]},${nums[1]}`
      for (let i = 2; i < nums.length; i += 2) d += `L${nums[i]},${nums[i + 1]}`
      if (tagName === 'polygon') d += 'Z'
      return d
    }
    default:
      return null
  }
}

function resolveAttr(
  explicit: string | null,
  group: string | null,
  fallback: string | null
): string | null {
  if (explicit !== null) return explicit === 'none' ? null : explicit
  if (group !== null) return group === 'none' ? null : group
  return fallback
}

function extractPaths(svgBody: string): PathInfo[] {
  const groupAttrs = {
    fill: null as string | null,
    stroke: null as string | null,
    strokeWidth: null as string | null,
    strokeCap: null as string | null,
    strokeJoin: null as string | null
  }
  const groupRe = /<g\b[^>]*>/g
  let gm
  while ((gm = groupRe.exec(svgBody)) !== null) {
    groupAttrs.fill ??= attrValue(gm[0], 'fill')
    groupAttrs.stroke ??= attrValue(gm[0], 'stroke')
    groupAttrs.strokeWidth ??= attrValue(gm[0], 'stroke-width')
    groupAttrs.strokeCap ??= attrValue(gm[0], 'stroke-linecap')
    groupAttrs.strokeJoin ??= attrValue(gm[0], 'stroke-linejoin')
  }

  const result: PathInfo[] = []
  const shapeRe = /<(path|circle|ellipse|rect|line|polygon|polyline)\b[^>]*>/g
  let match
  while ((match = shapeRe.exec(svgBody)) !== null) {
    const tag = match[0],
      tagName = match[1]
    const d = tagName === 'path' ? attrValue(tag, 'd') : shapeToD(tagName, tag)
    if (!d) continue

    const fillRuleAttr = attrValue(tag, 'fill-rule')
    result.push({
      d,
      fill: resolveAttr(attrValue(tag, 'fill'), groupAttrs.fill, 'currentColor'),
      stroke: resolveAttr(attrValue(tag, 'stroke'), groupAttrs.stroke, null),
      strokeWidth: parseFloat(attrValue(tag, 'stroke-width') ?? groupAttrs.strokeWidth ?? '1'),
      strokeCap: attrValue(tag, 'stroke-linecap') ?? groupAttrs.strokeCap ?? 'butt',
      strokeJoin: attrValue(tag, 'stroke-linejoin') ?? groupAttrs.strokeJoin ?? 'miter',
      fillRule: fillRuleAttr === 'evenodd' ? 'EVENODD' : 'NONZERO'
    })
  }
  return result
}

function buildIconData(
  iconEntry: IconifyIconEntry,
  prefix: string,
  iconName: string,
  defaultW: number,
  defaultH: number,
  size: number
): IconData {
  const rendered = iconToSVG({
    body: iconEntry.body,
    width: iconEntry.width ?? defaultW,
    height: iconEntry.height ?? defaultH
  })
  const [, , vbW, vbH] = rendered.viewBox
  const sx = size / vbW
  const sy = size / vbH

  const pathInfos = extractPaths(rendered.body)

  return {
    prefix,
    name: iconName,
    width: size,
    height: size,
    paths: pathInfos.map((p) => {
      const scaledD = sx === 1 && sy === 1 ? p.d : svgpath(p.d).scale(sx, sy).round(2).toString()
      return {
        vectorNetwork: parseSVGPath(scaledD, p.fillRule),
        fill: p.fill,
        stroke: p.stroke,
        strokeWidth: p.strokeWidth * Math.min(sx, sy),
        strokeCap: p.strokeCap,
        strokeJoin: p.strokeJoin
      }
    })
  }
}

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

export async function fetchIcon(name: string, size = 24): Promise<IconData> {
  const results = await fetchIcons([name], size)
  const result = results.get(name)
  if (!result)
    throw new Error(`Icon "${name}" not found. Check the name at https://icon-sets.iconify.design/`)
  return result
}

export async function fetchIcons(names: string[], size = 24): Promise<Map<string, IconData>> {
  const results = new Map<string, IconData>()
  const toFetch = new Map<string, string[]>()

  for (const name of names) {
    const cacheKey = `${name}@${size}`
    const cached = iconCache.get(cacheKey)
    if (cached) {
      results.set(name, cached)
      continue
    }
    const { prefix, iconName } = parseIconName(name)
    const group = toFetch.get(prefix) ?? []
    group.push(iconName)
    toFetch.set(prefix, group)
  }

  const fetches = [...toFetch.entries()].map(async ([prefix, iconNames]) => {
    const url = `${ICONIFY_API}/${prefix}.json?icons=${iconNames.map(encodeURIComponent).join(',')}`
    const response = await fetchWithTimeout(url)
    if (!response.ok)
      throw new Error(`Iconify API error: ${response.status} for prefix "${prefix}"`)
    const data = (await response.json()) as IconifyResponse
    const defaultW = data.width ?? 24
    const defaultH = data.height ?? 24

    for (const iconName of iconNames) {
      const fullName = `${prefix}:${iconName}`
      let entry = data.icons[iconName]
      if (!entry) {
        const alias = data.aliases?.[iconName]
        if (alias) entry = data.icons[alias.parent]
      }
      if (!entry) continue
      const iconData = buildIconData(entry, prefix, iconName, defaultW, defaultH, size)
      iconCache.set(`${fullName}@${size}`, iconData)
      results.set(fullName, iconData)
    }
  })

  await Promise.all(fetches)
  return results
}

export interface IconSearchResult {
  icons: string[]
  total: number
  collections: Record<string, { name: string; total: number; category?: string }>
}

export async function searchIcons(
  query: string,
  options?: {
    limit?: number
    prefix?: string
  }
): Promise<IconSearchResult> {
  const params = new URLSearchParams({ query })
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.prefix) params.set('prefix', options.prefix)

  const response = await fetchWithTimeout(`${ICONIFY_API}/search?${params}`)
  if (!response.ok) throw new Error(`Iconify search error: ${response.status}`)
  const data = await response.json()
  const icons: string[] = data.icons ?? []
  const limit = options?.limit ?? 5
  return {
    icons: icons.slice(0, limit),
    total: data.total ?? 0,
    collections: data.collections ?? {}
  }
}

export async function searchIconsBatch(
  queries: string[],
  options?: {
    limit?: number
    prefix?: string
  }
): Promise<Map<string, IconSearchResult>> {
  const results = new Map<string, IconSearchResult>()
  await Promise.all(
    queries.map(async (query) => {
      const result = await searchIcons(query, options)
      results.set(query, result)
    })
  )
  return results
}
