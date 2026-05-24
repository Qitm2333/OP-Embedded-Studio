import type { Color } from '#core/types'

export interface ColorUsageEntry {
  hex: string
  color: Color
  count: number
  variableName: string | null
}
