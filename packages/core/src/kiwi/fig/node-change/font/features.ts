import type { NodeChange } from '#core/kiwi/fig/codec'
import type { FontFeature } from '#core/scene-graph'

const LIGATURE_FEATURES = [
  ['fontVariantCommonLigatures', 'LIGA'],
  ['fontVariantContextualLigatures', 'CALT']
] as const

function addFeature(features: FontFeature[], tag: string, enabled: boolean): void {
  const normalizedTag = tag.toUpperCase()
  if (features.some((feature) => feature.tag === normalizedTag)) return
  features.push({ tag: normalizedTag, enabled })
}

export function convertFontFeatures(nc: NodeChange): FontFeature[] {
  const features: FontFeature[] = []
  for (const [field, tag] of LIGATURE_FEATURES) {
    const enabled = nc[field]
    if (enabled !== undefined) addFeature(features, tag, enabled)
  }
  for (const tag of nc.toggledOnOTFeatures ?? []) addFeature(features, tag, true)
  for (const tag of nc.toggledOffOTFeatures ?? []) addFeature(features, tag, false)
  return features
}

export function applyFontFeaturesToKiwi(nc: NodeChange, features: FontFeature[]): void {
  const toggledOn: string[] = []
  const toggledOff: string[] = []

  for (const feature of features) {
    const tag = feature.tag.toUpperCase()
    if (tag === 'LIGA') nc.fontVariantCommonLigatures = feature.enabled
    else if (tag === 'CALT') nc.fontVariantContextualLigatures = feature.enabled
    else if (feature.enabled) toggledOn.push(tag)
    else toggledOff.push(tag)
  }

  if (toggledOn.length > 0) nc.toggledOnOTFeatures = toggledOn
  if (toggledOff.length > 0) nc.toggledOffOTFeatures = toggledOff
}
