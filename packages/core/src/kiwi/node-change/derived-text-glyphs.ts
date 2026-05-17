import type { NodeChange } from '#core/kiwi/binary/codec'
import type { FigmaDerivedTextGlyph } from '#core/scene-graph'

export function convertFigmaDerivedTextGlyphs(
  derivedTextData: NodeChange['derivedTextData'],
  blobs: Uint8Array[]
): FigmaDerivedTextGlyph[] {
  return (derivedTextData?.glyphs ?? [])
    .map((glyph) => {
      if (glyph.commandsBlob === undefined) return null
      return {
        commandsBlob: blobs[glyph.commandsBlob],
        x: glyph.position.x,
        y: glyph.position.y,
        fontSize: glyph.fontSize
      }
    })
    .filter((glyph): glyph is NonNullable<typeof glyph> => !!glyph)
}
