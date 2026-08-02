import type { SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { parseColor } from '#core/color'

type ShadowObject = {
  color: string | Color
  blur: number
  x?: number
  y?: number
  spread?: number
}

function isColor(value: unknown): value is Color {
  return (
    value !== null &&
    typeof value === 'object' &&
    'r' in value &&
    'g' in value &&
    'b' in value &&
    'a' in value
  )
}

function isShadowObject(value: unknown): value is ShadowObject {
  if (value === null || typeof value !== 'object') return false
  if (!('color' in value) || !('blur' in value)) return false
  return (
    (typeof value.color === 'string' || isColor(value.color)) &&
    typeof value.blur === 'number'
  )
}

export function applyShadowOverride(value: unknown, overrides: Partial<SceneNode>): void {
  if (typeof value === 'string') {
    const parts = value.split(/\s+/)
    if (parts.length < 4) return
    overrides.effects = [
      ...(overrides.effects ?? []),
      {
        type: 'DROP_SHADOW',
        color: parseColor(parts.slice(3).join(' ')),
        offset: { x: Number.parseFloat(parts[0]), y: Number.parseFloat(parts[1]) },
        radius: Number.parseFloat(parts[2]),
        spread: 0,
        visible: true
      }
    ]
    return
  }

  if (!isShadowObject(value)) return
  overrides.effects = [
    ...(overrides.effects ?? []),
    {
      type: 'DROP_SHADOW',
      color: typeof value.color === 'string' ? parseColor(value.color) : value.color,
      offset: { x: value.x ?? 0, y: value.y ?? 0 },
      radius: value.blur,
      spread: value.spread ?? 0,
      visible: true
    }
  ]
}
