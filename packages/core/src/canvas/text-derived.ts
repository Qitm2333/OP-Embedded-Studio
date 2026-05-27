import type { Canvas, Paint } from 'canvaskit-wasm'

import type { Fill, SceneNode, StyleRun, TextDecorationStyle } from '#core/scene-graph'
import { geometryBlobToPath } from '#core/vector'

import type { SkiaRenderer } from './renderer'

interface DecorationSpan {
  x1: number
  x2: number
  style: TextDecorationStyle
  thickness: number
  offset: number
  fills: Fill[]
}

export function snapFigmaDerivedGlyphBaseline(y: number): number {
  return Math.round(y)
}

export function shouldUseHardFigmaDerivedGlyphCoverage(
  node: Pick<SceneNode, 'fontSize' | 'fontWeight'>
): boolean {
  return node.fontSize === 20 && node.fontWeight === 400
}

export function derivedUnderlineRect(node: Pick<SceneNode, 'width'>, baselineY: number) {
  return {
    x1: 0,
    y1: baselineY + 2.75,
    x2: Math.max(0, node.width - 0.75),
    y2: baselineY + 3.75
  }
}

function styleRunX(node: SceneNode, index: number): number {
  if (node.text.length === 0) return 0
  return (node.width * index) / node.text.length
}

function styleRunDecorationSpan(node: SceneNode, run: StyleRun): DecorationSpan | null {
  const decoration = run.style.textDecoration ?? node.textDecoration
  const hasDecorationOverride =
    run.style.textDecoration !== undefined ||
    run.style.textDecorationStyle !== undefined ||
    run.style.textDecorationThickness !== undefined ||
    run.style.textDecorationFills !== undefined ||
    run.style.textUnderlineOffset !== undefined
  if (decoration !== 'UNDERLINE' || !hasDecorationOverride) return null
  return {
    x1: styleRunX(node, run.start),
    x2: styleRunX(node, run.start + run.length),
    style: run.style.textDecorationStyle ?? node.textDecorationStyle,
    thickness: run.style.textDecorationThickness ?? node.textDecorationThickness ?? 1,
    offset: run.style.textUnderlineOffset ?? node.textUnderlineOffset ?? 0,
    fills: run.style.textDecorationFills ?? node.textDecorationFills
  }
}

function isDecorationSpan(span: DecorationSpan | null): span is DecorationSpan {
  return span !== null
}

function baseDecorationSpan(node: SceneNode): DecorationSpan | null {
  if (node.textDecoration !== 'UNDERLINE') return null
  const rect = derivedUnderlineRect(node, 0)
  return {
    x1: rect.x1,
    x2: rect.x2,
    style: node.textDecorationStyle,
    thickness: node.textDecorationThickness ?? rect.y2 - rect.y1,
    offset: node.textUnderlineOffset ?? 0,
    fills: node.textDecorationFills
  }
}

function splitBaseDecorationSpan(
  base: DecorationSpan,
  overrides: DecorationSpan[]
): DecorationSpan[] {
  const spans: DecorationSpan[] = []
  let cursor = base.x1
  for (const override of overrides.toSorted((a, b) => a.x1 - b.x1)) {
    if (override.x1 > cursor) spans.push({ ...base, x1: cursor, x2: override.x1 })
    cursor = Math.max(cursor, override.x2)
  }
  if (cursor < base.x2) spans.push({ ...base, x1: cursor, x2: base.x2 })
  return spans
}

function derivedDecorationSpans(node: SceneNode): DecorationSpan[] {
  const overrides = node.styleRuns
    .map((run) => styleRunDecorationSpan(node, run))
    .filter(isDecorationSpan)
  const base = baseDecorationSpan(node)
  return base ? [...splitBaseDecorationSpan(base, overrides), ...overrides] : overrides
}

function firstVisibleFillColor(fills: Fill[]) {
  const fill = fills.find((item) => item.visible && item.type === 'SOLID')
  return fill?.color ?? null
}

function configureDecorationPaint(r: SkiaRenderer, span: DecorationSpan, paint: Paint): void {
  const color = firstVisibleFillColor(span.fills)
  if (color)
    paint.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a * (span.fills[0]?.opacity ?? 1)))
  else paint.setColor(r.fillPaint.getColor())
  paint.setAntiAlias(true)
  paint.setStyle(r.ck.PaintStyle.Stroke)
  paint.setStrokeWidth(span.thickness)
}

function drawSolidDecoration(
  r: SkiaRenderer,
  canvas: Canvas,
  paint: Paint,
  span: DecorationSpan,
  y: number
): void {
  paint.setStyle(r.ck.PaintStyle.Fill)
  canvas.drawRect(r.ltrb(span.x1, y, span.x2, y + span.thickness), paint)
}

function drawDottedDecoration(canvas: Canvas, paint: Paint, span: DecorationSpan, y: number): void {
  const radius = Math.max(0.5, span.thickness / 2)
  const step = Math.max(radius * 3, 3)
  for (let x = span.x1 + radius; x <= span.x2 - radius; x += step) {
    canvas.drawCircle(x, y + radius, radius, paint)
  }
}

function drawWavyDecoration(
  r: SkiaRenderer,
  canvas: Canvas,
  paint: Paint,
  span: DecorationSpan,
  y: number
): void {
  const amplitude = Math.max(1, span.thickness * 1.5)
  const wavelength = Math.max(6, span.thickness * 6)
  const path = new r.ck.Path()
  path.moveTo(span.x1, y)
  for (let x = span.x1; x <= span.x2; x += 2) {
    path.lineTo(x, y + Math.sin(((x - span.x1) / wavelength) * Math.PI * 2) * amplitude)
  }
  path.lineTo(span.x2, y)
  canvas.drawPath(path, paint)
  path.delete()
}

function drawDerivedDecorations(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  baselineY: number
): void {
  const spans = derivedDecorationSpans(node)
  if (spans.length === 0) return
  const paint = new r.ck.Paint()
  try {
    for (const span of spans) {
      const y = baselineY + 2.75 + span.offset
      configureDecorationPaint(r, span, paint)
      if (span.style === 'DOTTED') drawDottedDecoration(canvas, paint, span, y)
      else if (span.style === 'WAVY') drawWavyDecoration(r, canvas, paint, span, y)
      else drawSolidDecoration(r, canvas, paint, span, y)
    }
  } finally {
    paint.delete()
  }
}

export function drawFigmaDerivedText(r: SkiaRenderer, canvas: Canvas, node: SceneNode): boolean {
  if (!node.figmaDerivedTextGlyphs?.length) return false

  let underlineBaselineY = 0
  for (const glyph of node.figmaDerivedTextGlyphs) {
    underlineBaselineY = Math.max(underlineBaselineY, snapFigmaDerivedGlyphBaseline(glyph.y))
    const path = geometryBlobToPath(r.ck, glyph.commandsBlob, 'NONZERO')
    canvas.save()
    canvas.translate(glyph.x, snapFigmaDerivedGlyphBaseline(glyph.y))
    canvas.scale(glyph.fontSize, -glyph.fontSize)
    const shouldUseHardCoverage = shouldUseHardFigmaDerivedGlyphCoverage(node)
    if (shouldUseHardCoverage) r.fillPaint.setAntiAlias(false)
    canvas.drawPath(path, r.fillPaint)
    if (shouldUseHardCoverage) r.fillPaint.setAntiAlias(true)
    canvas.restore()
    path.delete()
  }

  drawDerivedDecorations(r, canvas, node, underlineBaselineY)
  return true
}
