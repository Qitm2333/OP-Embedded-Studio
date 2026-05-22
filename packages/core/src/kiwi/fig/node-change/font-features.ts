import type { NodeChange } from '#core/kiwi/fig/codec'
import type { FontFeature } from '#core/scene-graph'

const LIGATURE_FEATURES = [
  ['fontVariantCommonLigatures', 'LIGA'],
  ['fontVariantContextualLigatures', 'CALT']
] as const

export function convertFontFeatures(nc: NodeChange): FontFeature[] {
  const features: FontFeature[] = []
  for (const [field, tag] of LIGATURE_FEATURES) {
    const enabled = nc[field]
    if (enabled !== undefined) features.push({ tag, enabled })
  }
  return features
}

export function applyFontFeaturesToKiwi(nc: NodeChange, features: FontFeature[]): void {
  for (const feature of features) {
    if (feature.tag === 'LIGA') nc.fontVariantCommonLigatures = feature.enabled
    else if (feature.tag === 'CALT') nc.fontVariantContextualLigatures = feature.enabled
  }
}
