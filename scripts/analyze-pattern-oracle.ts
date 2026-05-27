#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { parseArgs } from 'node:util'

import { initCanvasKit } from '@open-pencil/core/io'

interface PixelImage {
  width: number
  height: number
  pixels: Uint8Array
}

interface Component {
  count: number
  cx: number
  cy: number
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface RowSummary {
  y: number
  count: number
  firstX: number
  lastX: number
}

const { values: opts } = parseArgs({
  options: {
    figma: {
      type: 'string',
      default: '/tmp/open-pencil-oracles/pattern-visible-source-tuned/figma.png'
    },
    ours: {
      type: 'string',
      default: '/tmp/open-pencil-oracles/pattern-visible-source-tuned/ours.png'
    },
    threshold: { type: 'string', default: '10' }
  }
})

const figmaPath = opts.figma ?? ''
const oursPath = opts.ours ?? ''
const minComponentPixels = Number(opts.threshold)

if (!existsSync(figmaPath)) throw new Error(`Missing Figma image: ${figmaPath}`)
if (!existsSync(oursPath)) throw new Error(`Missing OpenPencil image: ${oursPath}`)

const figma = await loadImage(figmaPath)
const ours = await loadImage(oursPath)
const figmaRows = summarizeRows(findPatternComponents(figma, minComponentPixels))
const oursRows = summarizeRows(findPatternComponents(ours, minComponentPixels))
const rowDeltas = nearestRowDeltas(figmaRows, oursRows)

console.log(JSON.stringify({ figma: figmaRows, ours: oursRows, rowDeltas }, null, 2))

async function loadImage(path: string): Promise<PixelImage> {
  const ck = await initCanvasKit()
  const data = await Bun.file(path).arrayBuffer()
  const image = ck.MakeImageFromEncoded(new Uint8Array(data))
  if (!image) throw new Error(`Failed to decode ${path}`)
  const width = image.width()
  const height = image.height()
  const pixels = image.readPixels(0, 0, {
    alphaType: ck.AlphaType.Unpremul,
    colorType: ck.ColorType.RGBA_8888,
    colorSpace: ck.ColorSpace.SRGB,
    width,
    height
  })
  image.delete()
  if (!pixels) throw new Error(`Failed to read pixels from ${path}`)
  return { width, height, pixels }
}

function isPatternPixel(image: PixelImage, x: number, y: number): boolean {
  const offset = (y * image.width + x) * 4
  const red = image.pixels[offset] ?? 0
  const green = image.pixels[offset + 1] ?? 0
  const blue = image.pixels[offset + 2] ?? 0
  const alpha = image.pixels[offset + 3] ?? 0
  return alpha > 128 && red > 200 && green > 40 && green < 140 && blue < 100
}

function findPatternComponents(image: PixelImage, minPixels: number): Component[] {
  const visited = new Uint8Array(image.width * image.height)
  const components: Component[] = []

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = y * image.width + x
      if (visited[index] || !isPatternPixel(image, x, y)) continue
      const component = collectComponent(image, x, y, visited)
      if (component.count >= minPixels) components.push(component)
    }
  }
  return components
}

function collectComponent(
  image: PixelImage,
  startX: number,
  startY: number,
  visited: Uint8Array
): Component {
  const stack = [{ x: startX, y: startY }]
  visited[startY * image.width + startX] = 1
  let count = 0
  let sumX = 0
  let sumY = 0
  let minX = startX
  let minY = startY
  let maxX = startX
  let maxY = startY

  while (stack.length > 0) {
    const point = stack.pop()
    if (!point) continue
    count++
    sumX += point.x
    sumY += point.y
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    for (let ny = point.y - 1; ny <= point.y + 1; ny++) {
      for (let nx = point.x - 1; nx <= point.x + 1; nx++) {
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue
        const index = ny * image.width + nx
        if (visited[index] || !isPatternPixel(image, nx, ny)) continue
        visited[index] = 1
        stack.push({ x: nx, y: ny })
      }
    }
  }

  return { count, cx: sumX / count, cy: sumY / count, minX, minY, maxX, maxY }
}

function summarizeRows(components: Component[]): RowSummary[] {
  const rows = new Map<number, Component[]>()
  for (const component of components) {
    const y = Math.round(component.cy)
    const row = rows.get(y) ?? []
    row.push(component)
    rows.set(y, row)
  }
  return [...rows.entries()]
    .map(([y, row]) => {
      const sorted = row.toSorted((a, b) => a.cx - b.cx)
      return {
        y,
        count: sorted.length,
        firstX: Number((sorted[0]?.cx ?? 0).toFixed(2)),
        lastX: Number((sorted.at(-1)?.cx ?? 0).toFixed(2))
      }
    })
    .toSorted((a, b) => a.y - b.y)
}

function nearestRowDeltas(figmaRows: RowSummary[], oursRows: RowSummary[]) {
  return figmaRows.map((figmaRow) => {
    const nearest = oursRows.toSorted(
      (a, b) => Math.abs(a.y - figmaRow.y) - Math.abs(b.y - figmaRow.y)
    )[0]
    return {
      figmaY: figmaRow.y,
      oursY: nearest?.y ?? null,
      deltaY: nearest ? Number((nearest.y - figmaRow.y).toFixed(2)) : null,
      figmaFirstX: figmaRow.firstX,
      oursFirstX: nearest?.firstX ?? null,
      deltaFirstX: nearest ? Number((nearest.firstX - figmaRow.firstX).toFixed(2)) : null
    }
  })
}
