import { BLACK, DEFAULT_STROKE_MITER_LIMIT } from '../constants'
import { styleToWeight } from '../fonts'
import { decodeVectorNetworkBlob } from '../vector'

import type {
  SceneNode,
  NodeType,
  Fill,
  FillType,
  Stroke,
  Effect,
  Color,
  BlendMode,
  ImageScaleMode,
  GradientTransform,
  StrokeCap,
  StrokeJoin,
  LayoutMode,
  LayoutSizing,
  LayoutAlign,
  LayoutCounterAlign,
  ConstraintType,
  TextAutoResize,
  TextAlignVertical,
  TextCase,
  TextDecoration,
  ArcData,
  VectorNetwork,
  StyleRun,
  CharacterStyleOverride
} from '../scene-graph'
import type { NodeChange, Paint, Effect as KiwiEffect, GUID } from './codec'

function ext(nc: NodeChange): Record<string, unknown> {
  return nc as unknown as Record<string, unknown>
}

export function guidToString(guid: GUID): string {
  return `${guid.sessionID}:${guid.localID}`
}

function convertColor(color?: { r: number; g: number; b: number; a: number }): Color {
  if (!color) return { ...BLACK }
  return { r: color.r, g: color.g, b: color.b, a: color.a }
}

function imageHashToString(hash: Record<string, number>): string {
  const bytes = Object.keys(hash)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => hash[Number(k)])
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function convertGradientTransform(t?: {
  m00: number
  m01: number
  m02: number
  m10: number
  m11: number
  m12: number
}): GradientTransform | undefined {
  if (!t) return undefined
  return { m00: t.m00, m01: t.m01, m02: t.m02, m10: t.m10, m11: t.m11, m12: t.m12 }
}

export function convertFills(paints?: Paint[]): Fill[] {
  if (!paints) return []
  return paints.map((p) => {
    const base: Fill = {
      type: (p.type ?? 'SOLID') as FillType,
      color: convertColor(p.color),
      opacity: p.opacity ?? 1,
      visible: p.visible ?? true,
      blendMode: (p.blendMode ?? 'NORMAL') as BlendMode
    }

    if (p.type?.startsWith('GRADIENT') && p.stops) {
      base.gradientStops = p.stops.map((s) => ({
        color: convertColor(s.color),
        position: s.position
      }))
      if (p.transform) {
        base.gradientTransform = convertGradientTransform(p.transform)
      }
    }

    if (p.type === 'IMAGE') {
      if (p.image && typeof p.image === 'object') {
        const img = p.image as { hash: string | Record<string, number> }
        if (typeof img.hash === 'object') {
          base.imageHash = imageHashToString(img.hash)
        } else if (typeof img.hash === 'string') {
          base.imageHash = img.hash
        }
      }
      base.imageScaleMode = (p.imageScaleMode as ImageScaleMode) ?? 'FILL'
      if (p.transform) {
        base.imageTransform = convertGradientTransform(p.transform)
      }
    }

    return base
  })
}

export function convertStrokes(
  paints?: Paint[],
  weight?: number,
  align?: string,
  cap?: string,
  join?: string,
  dashPattern?: number[]
): Stroke[] {
  if (!paints) return []
  return paints.map((p) => ({
    color: convertColor(p.color),
    weight: weight ?? 1,
    opacity: p.opacity ?? 1,
    visible: p.visible ?? true,
    align: (align === 'INSIDE'
      ? 'INSIDE'
      : align === 'OUTSIDE'
        ? 'OUTSIDE'
        : 'CENTER') as Stroke['align'],
    cap: (cap ?? 'NONE') as StrokeCap,
    join: (join ?? 'MITER') as StrokeJoin,
    dashPattern: dashPattern ?? []
  }))
}

export function convertEffects(effects?: KiwiEffect[]): Effect[] {
  if (!effects) return []
  return effects.map((e) => ({
    type: e.type as Effect['type'],
    color: convertColor(e.color),
    offset: e.offset ?? { x: 0, y: 0 },
    radius: e.radius ?? 0,
    spread: e.spread ?? 0,
    visible: e.visible ?? true,
    blendMode: (e.blendMode as BlendMode) ?? 'NORMAL'
  }))
}

export function mapNodeType(type?: string): NodeType | 'DOCUMENT' | 'VARIABLE' {
  switch (type) {
    case 'DOCUMENT':
      return 'DOCUMENT'
    case 'VARIABLE':
      return 'VARIABLE'
    case 'CANVAS':
      return 'CANVAS'
    case 'FRAME':
      return 'FRAME'
    case 'RECTANGLE':
      return 'RECTANGLE'
    case 'ROUNDED_RECTANGLE':
      return 'ROUNDED_RECTANGLE'
    case 'ELLIPSE':
      return 'ELLIPSE'
    case 'TEXT':
      return 'TEXT'
    case 'LINE':
      return 'LINE'
    case 'STAR':
      return 'STAR'
    case 'REGULAR_POLYGON':
      return 'POLYGON'
    case 'VECTOR':
      return 'VECTOR'
    case 'BOOLEAN_OPERATION':
      return 'VECTOR'
    case 'GROUP':
      return 'GROUP'
    case 'SECTION':
      return 'SECTION'
    case 'COMPONENT':
      return 'COMPONENT'
    case 'COMPONENT_SET':
      return 'COMPONENT_SET'
    case 'INSTANCE':
      return 'INSTANCE'
    case 'SYMBOL':
      return 'COMPONENT'
    case 'CONNECTOR':
      return 'CONNECTOR'
    case 'SHAPE_WITH_TEXT':
      return 'SHAPE_WITH_TEXT'
    default:
      return 'RECTANGLE'
  }
}

export function mapStackMode(mode?: string): LayoutMode {
  switch (mode) {
    case 'HORIZONTAL':
      return 'HORIZONTAL'
    case 'VERTICAL':
      return 'VERTICAL'
    default:
      return 'NONE'
  }
}

export function mapStackSizing(sizing?: string): LayoutSizing {
  switch (sizing) {
    case 'RESIZE_TO_FIT':
    case 'RESIZE_TO_FIT_WITH_IMPLICIT_SIZE':
      return 'HUG'
    case 'FILL':
      return 'FILL'
    default:
      return 'FIXED'
  }
}

export function mapStackJustify(justify?: string): LayoutAlign {
  switch (justify) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'SPACE_BETWEEN':
    case 'SPACE_EVENLY':
      return 'SPACE_BETWEEN'
    default:
      return 'MIN'
  }
}

export function mapStackCounterAlign(align?: string): LayoutCounterAlign {
  switch (align) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'STRETCH':
      return 'STRETCH'
    case 'BASELINE':
      return 'BASELINE'
    default:
      return 'MIN'
  }
}

export function mapConstraint(c?: string): ConstraintType {
  switch (c) {
    case 'CENTER':
      return 'CENTER'
    case 'MAX':
      return 'MAX'
    case 'STRETCH':
      return 'STRETCH'
    case 'SCALE':
      return 'SCALE'
    default:
      return 'MIN'
  }
}

export function mapTextDecoration(d?: string): TextDecoration {
  switch (d) {
    case 'UNDERLINE':
      return 'UNDERLINE'
    case 'STRIKETHROUGH':
      return 'STRIKETHROUGH'
    default:
      return 'NONE'
  }
}

function convertLetterSpacing(
  ls?: { value: number; units: string },
  fontSize?: number
): number {
  if (!ls) return 0
  if (ls.units === 'PIXELS') return ls.value
  if (ls.units === 'PERCENT') return (ls.value / 100) * (fontSize ?? 14)
  return ls.value
}

export function mapArcData(data?: Record<string, number>): ArcData | null {
  if (!data) return null
  return {
    startingAngle: data.startingAngle ?? 0,
    endingAngle: data.endingAngle ?? 2 * Math.PI,
    innerRadius: data.innerRadius ?? 0
  }
}

export function importStyleRuns(nc: NodeChange): StyleRun[] {
  const td = nc.textData
  if (!td?.characterStyleIDs || !td.styleOverrideTable) return []

  const ids = td.characterStyleIDs
  const table = td.styleOverrideTable
  if (ids.length === 0 || table.length === 0) return []

  const styleMap = new Map<number, CharacterStyleOverride>()
  for (const override of table) {
    const id = (override as unknown as Record<string, unknown>).styleID as number | undefined
    if (id === undefined) continue
    const style: CharacterStyleOverride = {}
    if (override.fontName) {
      style.fontFamily = override.fontName.family
      style.fontWeight = styleToWeight(override.fontName.style ?? '')
      style.italic = override.fontName.style?.toLowerCase().includes('italic') ?? false
    }
    if (override.fontSize !== undefined) style.fontSize = override.fontSize
    if (override.letterSpacing) style.letterSpacing = override.letterSpacing.value
    if (override.lineHeight) style.lineHeight = override.lineHeight.value
    const deco = ext(override).textDecoration as string | undefined
    if (deco) style.textDecoration = mapTextDecoration(deco)
    if (Object.keys(style).length > 0) styleMap.set(id, style)
  }

  if (styleMap.size === 0) return []

  const runs: StyleRun[] = []
  let currentId = ids[0]
  let start = 0

  for (let i = 1; i <= ids.length; i++) {
    if (i === ids.length || ids[i] !== currentId) {
      if (currentId !== 0) {
        const style = styleMap.get(currentId)
        if (style) runs.push({ start, length: i - start, style })
      }
      if (i < ids.length) {
        currentId = ids[i]
        start = i
      }
    }
  }

  return runs
}

export function resolveVectorNetwork(
  nc: NodeChange,
  blobs: Uint8Array[]
): VectorNetwork | null {
  const vectorData = (nc as unknown as Record<string, unknown>).vectorData as
    | {
        vectorNetworkBlob?: number
        styleOverrideTable?: Array<{ styleID: number; handleMirroring?: string }>
      }
    | undefined

  if (!vectorData || vectorData.vectorNetworkBlob === undefined) return null
  const idx = vectorData.vectorNetworkBlob
  if (idx < 0 || idx >= blobs.length) return null

  try {
    return decodeVectorNetworkBlob(blobs[idx], vectorData.styleOverrideTable)
  } catch {
    return null
  }
}

export function extractBoundVariables(nc: NodeChange): Record<string, string> {
  const bindings: Record<string, string> = {}
  nc.fillPaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`fills/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  nc.strokePaints?.forEach((paint, i) => {
    if (paint.colorVariableBinding) {
      bindings[`strokes/${i}/color`] = guidToString(paint.colorVariableBinding.variableID)
    }
  })
  return bindings
}

export function nodeChangeToProps(
  nc: NodeChange,
  blobs: Uint8Array[]
): Partial<SceneNode> & { nodeType: NodeType | 'DOCUMENT' | 'VARIABLE' } {
  const nodeType = mapNodeType(nc.type)

  const x = nc.transform?.m02 ?? 0
  const y = nc.transform?.m12 ?? 0
  const width = nc.size?.x ?? 100
  const height = nc.size?.y ?? 100

  let rotation = 0
  let flipX = false
  let flipY = false
  if (nc.transform) {
    const det = nc.transform.m00 * nc.transform.m11 - nc.transform.m01 * nc.transform.m10
    if (det < 0) flipX = true
    const sx = flipX ? -1 : 1
    rotation = Math.atan2(nc.transform.m10 * sx, nc.transform.m00 * sx) * (180 / Math.PI)
  }

  const dashPattern = (ext(nc).dashPattern as number[]) ?? []

  return {
    nodeType,
    name: nc.name ?? nodeType,
    x,
    y,
    width,
    height,
    rotation,
    flipX,
    flipY,
    opacity: nc.opacity ?? 1,
    visible: nc.visible ?? true,
    locked: nc.locked ?? false,
    blendMode: (ext(nc).blendMode as Fill['blendMode']) ?? 'PASS_THROUGH',
    fills: convertFills(nc.fillPaints),
    strokes: convertStrokes(
      nc.strokePaints,
      nc.strokeWeight,
      nc.strokeAlign,
      nc.strokeCap,
      nc.strokeJoin,
      dashPattern
    ),
    effects: convertEffects(nc.effects),
    cornerRadius: nc.cornerRadius ?? 0,
    topLeftRadius: nc.rectangleTopLeftCornerRadius ?? nc.cornerRadius ?? 0,
    topRightRadius: nc.rectangleTopRightCornerRadius ?? nc.cornerRadius ?? 0,
    bottomRightRadius: nc.rectangleBottomRightCornerRadius ?? nc.cornerRadius ?? 0,
    bottomLeftRadius: nc.rectangleBottomLeftCornerRadius ?? nc.cornerRadius ?? 0,
    independentCorners: nc.rectangleCornerRadiiIndependent ?? false,
    cornerSmoothing: nc.cornerSmoothing ?? 0,
    text: nc.textData?.characters ?? '',
    fontSize: nc.fontSize ?? 14,
    fontFamily: nc.fontName?.family ?? 'Inter',
    fontWeight: styleToWeight(nc.fontName?.style ?? ''),
    italic: nc.fontName?.style?.toLowerCase().includes('italic') ?? false,
    textAlignHorizontal:
      (nc.textAlignHorizontal as 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED') ?? 'LEFT',
    textAlignVertical: (ext(nc).textAlignVertical as TextAlignVertical) ?? 'TOP',
    textAutoResize: (ext(nc).textAutoResize as TextAutoResize) ?? 'NONE',
    textCase: (ext(nc).textCase as TextCase) ?? 'ORIGINAL',
    textDecoration: mapTextDecoration(ext(nc).textDecoration as string),
    lineHeight: nc.lineHeight?.value ?? null,
    letterSpacing: convertLetterSpacing(nc.letterSpacing, nc.fontSize),
    maxLines: (ext(nc).maxLines as number) ?? null,
    styleRuns: importStyleRuns(nc),
    horizontalConstraint: mapConstraint(ext(nc).horizontalConstraint as string),
    verticalConstraint: mapConstraint(ext(nc).verticalConstraint as string),
    layoutMode: mapStackMode(nc.stackMode),
    itemSpacing: nc.stackSpacing ?? 0,
    paddingTop: nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingBottom: nc.stackPaddingBottom ?? nc.stackVerticalPadding ?? nc.stackPadding ?? 0,
    paddingLeft: nc.stackHorizontalPadding ?? nc.stackPadding ?? 0,
    paddingRight: nc.stackPaddingRight ?? nc.stackHorizontalPadding ?? nc.stackPadding ?? 0,
    primaryAxisSizing: mapStackSizing(nc.stackPrimarySizing),
    counterAxisSizing: mapStackSizing(nc.stackCounterSizing),
    primaryAxisAlign: mapStackJustify(nc.stackPrimaryAlignItems ?? nc.stackJustify),
    counterAxisAlign: mapStackCounterAlign(nc.stackCounterAlignItems ?? nc.stackCounterAlign),
    layoutWrap: ext(nc).stackWrap === 'WRAP' ? 'WRAP' : 'NO_WRAP',
    counterAxisSpacing: (ext(nc).stackCounterSpacing as number) ?? 0,
    layoutPositioning: ext(nc).stackPositioning === 'ABSOLUTE' ? 'ABSOLUTE' : 'AUTO',
    layoutGrow: (ext(nc).stackChildPrimaryGrow as number) ?? 0,
    layoutAlignSelf: (ext(nc).stackChildAlignSelf as string) === 'STRETCH' ? 'STRETCH' : 'AUTO',
    vectorNetwork: resolveVectorNetwork(nc, blobs),
    arcData: mapArcData(ext(nc).arcData as Record<string, number> | undefined),
    strokeCap: (nc.strokeCap ?? 'NONE') as StrokeCap,
    strokeJoin: (nc.strokeJoin ?? 'MITER') as StrokeJoin,
    dashPattern,
    borderTopWeight: (ext(nc).borderTopWeight as number) ?? 0,
    borderRightWeight: (ext(nc).borderRightWeight as number) ?? 0,
    borderBottomWeight: (ext(nc).borderBottomWeight as number) ?? 0,
    borderLeftWeight: (ext(nc).borderLeftWeight as number) ?? 0,
    independentStrokeWeights: (ext(nc).borderStrokeWeightsIndependent as boolean) ?? false,
    strokeMiterLimit: DEFAULT_STROKE_MITER_LIMIT,
    minWidth: (ext(nc).minWidth as number) ?? null,
    maxWidth: (ext(nc).maxWidth as number) ?? null,
    minHeight: (ext(nc).minHeight as number) ?? null,
    maxHeight: (ext(nc).maxHeight as number) ?? null,
    isMask: (ext(nc).isMask as boolean) ?? false,
    maskType: ((ext(nc).maskType as string) ?? 'ALPHA') as 'ALPHA' | 'VECTOR' | 'LUMINANCE',
    counterAxisAlignContent:
      (ext(nc).stackCounterAlignContent as string) === 'SPACE_BETWEEN' ? 'SPACE_BETWEEN' : 'AUTO',
    itemReverseZIndex: (ext(nc).stackReverseZIndex as boolean) ?? false,
    strokesIncludedInLayout: (ext(nc).strokesIncludedInLayout as boolean) ?? false,
    expanded: true,
    textTruncation: (ext(nc).textTruncation as string) === 'ENDING' ? 'ENDING' : 'DISABLED',
    autoRename: (ext(nc).autoRename as boolean) ?? true,
    boundVariables: extractBoundVariables(nc),
    clipsContent: nc.frameMaskDisabled === false
  }
}
