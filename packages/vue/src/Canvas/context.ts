import { type InjectionKey, inject, provide } from 'vue'

import type { Ref } from 'vue'

export interface CanvasContext {
  canvasRef: Ref<HTMLCanvasElement | null>
  ready: Ref<boolean>
  renderNow: () => void
  hitTestSectionTitle: (cx: number, cy: number) => unknown
  hitTestComponentLabel: (cx: number, cy: number) => unknown
  hitTestFrameTitle: (cx: number, cy: number) => unknown
}

export const CANVAS_KEY: InjectionKey<CanvasContext> = Symbol('canvas')

export function provideCanvas(ctx: CanvasContext) {
  provide(CANVAS_KEY, ctx)
}

export function useCanvasContext(): CanvasContext {
  const ctx = inject(CANVAS_KEY)
  if (!ctx) throw new Error('[open-pencil] useCanvasContext() called outside <CanvasRoot>')
  return ctx
}
