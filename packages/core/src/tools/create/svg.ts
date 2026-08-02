import svgpath from 'svgpath'

import type { VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'
import { DESIGN_ROLES, designMetadata } from '#core/design-semantics'
import { createPathStroke } from '#core/icons/path-style'
import { extractPaths } from '#core/icons/svg'
import type { IconPathInfo } from '#core/icons/types'
import { parseSVGPath } from '#core/io/formats/svg/parse-path'
import { defineTool } from '#core/tools/schema'

function parseSvgViewBox(svg: string): Rect | null {
  const match = svg.match(/viewBox="([^"]+)"/i)
  if (!match) return null
  const [x, y, width, height] = match[1].split(/[\s,]+/).map(Number)
  if ([x, y, width, height].some((value) => !Number.isFinite(value))) return null
  if (width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

function parseSvgDimension(svg: string, attr: string): number | null {
  const match = svg.match(new RegExp(`\\b${attr}="([^"]+)"`, 'i'))
  if (!match) return null
  const value = Number.parseFloat(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

function parseSvgSize(svg: string): { width: number; height: number } {
  const viewBox = parseSvgViewBox(svg)
  const width = parseSvgDimension(svg, 'width')
  const height = parseSvgDimension(svg, 'height')
  if (width && height) return { width, height }
  if (viewBox) return { width: viewBox.width, height: viewBox.height }
  return { width: 24, height: 24 }
}

function transformPath(
  path: IconPathInfo,
  source: Rect,
  target: { width: number; height: number },
  padding: number
): { vectorNetwork: VectorNetwork; strokeScale: number } {
  const innerWidth = Math.max(1, target.width - padding * 2)
  const innerHeight = Math.max(1, target.height - padding * 2)
  const scaleX = innerWidth / source.width
  const scaleY = innerHeight / source.height
  const d = svgpath(path.d)
    .translate(-source.x, -source.y)
    .scale(scaleX, scaleY)
    .translate(padding, padding)
    .round(3)
    .toString()
  const vectorNetwork = parseSVGPath(d, path.fillRule)
  if (vectorNetwork.vertices.length === 0) {
    throw new Error('A path produced no drawable geometry.')
  }
  return {
    vectorNetwork,
    strokeScale: Math.min(scaleX, scaleY)
  }
}

function createVectorFromPath(
  figma: Parameters<Parameters<typeof defineTool>[0]['execute']>[0],
  path: IconPathInfo,
  parsed: { vectorNetwork: VectorNetwork; strokeScale: number },
  width: number,
  height: number,
  parentId: string,
  defaultColor: string
) {
  const vector = figma.graph.createNode('VECTOR', parentId, {
    name: 'path',
    width,
    height,
    vectorNetwork: parsed.vectorNetwork
  })
  vector.x = 0
  vector.y = 0

  if (path.fill && path.fill !== 'none') {
    const fillColor =
      path.fill === 'currentColor' ? parseColor(defaultColor) : parseColor(path.fill)
    figma.graph.updateNode(vector.id, {
      fills: [{ type: 'SOLID', color: fillColor, opacity: 1, visible: true }]
    })
  } else if (path.fill === null && !path.stroke) {
    figma.graph.updateNode(vector.id, {
      fills: [{ type: 'SOLID', color: parseColor(defaultColor), opacity: 1, visible: true }]
    })
  } else {
    figma.graph.updateNode(vector.id, { fills: [] })
  }

  if (path.stroke && path.stroke !== 'none') {
    const strokeColor =
      path.stroke === 'currentColor' ? parseColor(defaultColor) : parseColor(path.stroke)
    figma.graph.updateNode(vector.id, {
      strokes: [
        createPathStroke(
          strokeColor,
          path.strokeWidth * parsed.strokeScale,
          path.strokeCap,
          path.strokeJoin
        )
      ]
    })
  }
}

export const importSvg = defineTool({
  name: 'import_svg',
  mutates: true,
  description:
    'Import model-generated SVG markup as local editable vectors. Normalizes viewBox coordinates, supports output sizing and safe padding, and never requires a remote icon service.',
  params: {
    svg: {
      type: 'string',
      description: 'Raw SVG markup containing supported vector elements',
      required: true
    },
    name: { type: 'string', description: 'Name for the created frame (default: SVG)' },
    color: {
      type: 'color',
      description: 'Default color for currentColor fills and strokes (default: #000000)'
    },
    parent_id: { type: 'string', description: 'Parent node ID' },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' },
    width: { type: 'number', description: 'Output width', min: 1 },
    height: { type: 'number', description: 'Output height', min: 1 },
    padding: {
      type: 'number',
      description: 'Inner padding in output pixels for strokes and optical breathing room',
      min: 0,
      default: 0
    },
    design_role: {
      type: 'string',
      description: 'Validation role for the imported artwork',
      enum: [...DESIGN_ROLES],
      default: 'decoration'
    },
    allow_overlap: {
      type: 'boolean',
      description: 'Allow intentional overlap for this artwork',
      default: true
    }
  },
  execute: async (figma, args) => {
    const svg = args.svg
    if (!svg || typeof svg !== 'string') return { error: 'SVG markup is required.' }

    const paths = extractPaths(svg)
    if (paths.length === 0) {
      return {
        error:
          'SVG contains no supported vector elements. Use path, circle, ellipse, rect, line, polygon, or polyline.'
      }
    }

    const intrinsic = parseSvgSize(svg)
    const source = parseSvgViewBox(svg) ?? { x: 0, y: 0, ...intrinsic }
    const padding = Math.max(0, Number(args.padding ?? 0))
    const width = Math.max(1, Number(args.width ?? intrinsic.width + padding * 2))
    const height = Math.max(1, Number(args.height ?? intrinsic.height + padding * 2))

    let parsedPaths: Array<{
      path: IconPathInfo
      parsed: { vectorNetwork: VectorNetwork; strokeScale: number }
    }>
    try {
      parsedPaths = paths.map((path) => ({
        path,
        parsed: transformPath(path, source, { width, height }, padding)
      }))
    } catch (error) {
      return {
        error: `SVG path parsing failed before import: ${error instanceof Error ? error.message : String(error)}`
      }
    }

    const parentId = args.parent_id ?? figma.currentPage.id
    if (!figma.graph.getNode(parentId)) return { error: `Parent node "${parentId}" not found.` }

    const frame = figma.graph.createNode('FRAME', parentId, {
      name: args.name ?? 'SVG',
      width,
      height,
      fills: [],
      pluginData: designMetadata(args.design_role ?? 'decoration', args.allow_overlap ?? true)
    })
    if (args.x !== undefined) frame.x = args.x
    if (args.y !== undefined) frame.y = args.y

    const defaultColor = args.color ?? '#000000'
    for (const item of parsedPaths) {
      createVectorFromPath(figma, item.path, item.parsed, width, height, frame.id, defaultColor)
    }

    return {
      id: frame.id,
      name: frame.name,
      type: frame.type,
      width,
      height,
      paths: parsedPaths.length,
      normalized: true
    }
  }
})
