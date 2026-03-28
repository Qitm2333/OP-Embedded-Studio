import type { OkHCLColor } from '@open-pencil/core'

export type ColorModel = 'rgba' | 'okhcl'

export interface OkHCLControls {
  model: ColorModel
  modelOptions: { value: ColorModel; label: string }[]
  okhcl: OkHCLColor | null
  setModel: (model: ColorModel) => void
  updateOkHCL: (patch: Partial<OkHCLColor>) => void
}
