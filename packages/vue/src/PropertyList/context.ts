import { type InjectionKey, inject, provide } from 'vue'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core'
import type { ComputedRef } from 'vue'

type ArrayPropKey = 'fills' | 'strokes' | 'effects'

export interface PropertyListContext {
  editor: Editor
  propKey: ArrayPropKey
  items: ComputedRef<unknown[]>
  isMixed: ComputedRef<boolean>
  activeNode: ComputedRef<SceneNode | null>
  isMulti: ComputedRef<boolean>
  add: (defaults: unknown) => void
  remove: (index: number) => void
  update: (index: number, item: unknown) => void
  toggleVisibility: (index: number) => void
}

export const PROPERTY_LIST_KEY: InjectionKey<PropertyListContext> = Symbol('property-list')

export function providePropertyList(ctx: PropertyListContext) {
  provide(PROPERTY_LIST_KEY, ctx)
}

export function usePropertyList(): PropertyListContext {
  const ctx = inject(PROPERTY_LIST_KEY)
  if (!ctx) throw new Error('[open-pencil] usePropertyList() called outside <PropertyListRoot>')
  return ctx
}
