export interface ParsedFontStyle {
  weight: number
  italic: boolean
}

export interface FontFaceRef extends ParsedFontStyle {
  family: string
  style: string
  postscriptName?: string
}

const FONT_STYLE_WEIGHTS: Array<[RegExp, number]> = [
  [/(?:extra|ultra)?(?:thin|hairline)/u, 100],
  [/(?:extra|ultra)light/u, 200],
  [/light/u, 300],
  [/(?:regular|normal|book|roman|plain)/u, 400],
  [/medium/u, 500],
  [/(?:semi|demi)bold/u, 600],
  [/(?:extra|ultra)bold/u, 800],
  [/(?:black|heavy)/u, 900],
  [/bold/u, 700]
]

export function normalizeFontStyleName(style: string): string {
  return style
    .toLowerCase()
    .replace(/italic|oblique/u, '')
    .replace(/[^a-z0-9]+/gu, '')
}

export function parseFontStyle(style: string | undefined): ParsedFontStyle {
  const raw = style ?? ''
  const italic = /(?:italic|oblique)/iu.test(raw)
  const normalized = normalizeFontStyleName(raw)
  const numericWeight = normalized.match(/(?:^|[^0-9])([1-9]00)(?:[^0-9]|$)/u)?.[1]
  if (numericWeight) return { weight: Number(numericWeight), italic }

  for (const [pattern, weight] of FONT_STYLE_WEIGHTS) {
    if (pattern.test(normalized)) return { weight, italic }
  }

  return { weight: 400, italic }
}

export function fontFaceFromFigmaFontName(fontName: {
  family?: string
  style?: string
  postscript?: string
}): FontFaceRef {
  const style = fontName.style ?? 'Regular'
  return {
    family: fontName.family ?? 'Inter',
    style,
    postscriptName: fontName.postscript,
    ...parseFontStyle(style)
  }
}

export function fontFaceRenderFamily(family: string, style: string): string {
  return `__op_font__${family.replace(/[^a-z0-9_-]+/giu, '_')}__${style.replace(/[^a-z0-9_-]+/giu, '_')}`
}
