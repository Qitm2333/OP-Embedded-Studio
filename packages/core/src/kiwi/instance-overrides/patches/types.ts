import type { SceneNode } from '#core/scene-graph'

export type OverridePatchSource = 'symbol-override' | 'component-prop' | 'derived-symbol-data'

export interface OverridePatch {
  targetId: string
  source: OverridePatchSource
  props?: Partial<SceneNode>
  swapComponentId?: string
}
