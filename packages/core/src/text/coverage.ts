import type { SceneNode } from '@open-pencil/scene-graph'

import { DEFAULT_FONT_FAMILY } from '#core/constants'
import type { FontFallbackScript } from '#core/text/fallbacks'
import { weightToStyle } from '#core/text/fonts'
import { fontGlyphCoverageSync } from '#core/text/opentype'

const CJK_CHAR_RE = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/u
const ARABIC_CHAR_RE = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/u

function scriptCharRegex(script: FontFallbackScript): RegExp {
  return script === 'cjk' ? CJK_CHAR_RE : ARABIC_CHAR_RE
}

function styleForCharacter(node: SceneNode, index: number): { family: string; style: string } {
  const baseFamily = node.fontFamily || DEFAULT_FONT_FAMILY
  let family = baseFamily
  let weight = node.fontWeight
  let italic = node.italic

  const run = node.styleRuns.find((item) => index >= item.start && index < item.start + item.length)
  if (run) {
    family = run.style.fontFamily ?? family
    weight = run.style.fontWeight ?? weight
    italic = run.style.italic ?? italic
  }

  return { family, style: weightToStyle(weight, italic) }
}

/**
 * Returns true only when a loaded, parseable primary font is known to miss a script glyph.
 * Unknown coverage is treated as renderable so we do not degrade fonts CanvasKit may handle.
 */
export function textNeedsFallbackScript(node: SceneNode, script: FontFallbackScript): boolean {
  if (node.type !== 'TEXT' || !node.text) return false
  const regex = scriptCharRegex(script)

  for (let index = 0; index < node.text.length; index++) {
    const char = node.text[index]
    if (!char || !regex.test(char)) continue
    const { family, style } = styleForCharacter(node, index)
    if (fontGlyphCoverageSync(family, style, char) === 'missing') return true
  }

  return false
}

export function textNeededFallbackScripts(node: SceneNode): FontFallbackScript[] {
  return (['cjk', 'arabic'] as const).filter((script) => textNeedsFallbackScript(node, script))
}
