const DRAW_METHODS = [
  'drawArrays',
  'drawElements',
  'drawArraysInstanced',
  'drawElementsInstanced'
] as const

type DrawMethod = (typeof DRAW_METHODS)[number]

export class DrawCallCounter {
  count = 0

  private originals = new Map<DrawMethod, (...args: unknown[]) => void>()
  private gl: WebGL2RenderingContext | null

  constructor(gl: WebGL2RenderingContext | null) {
    this.gl = gl
    if (!gl) return

    for (const method of DRAW_METHODS) {
      const original = gl[method].bind(gl) as (...args: unknown[]) => void
      this.originals.set(method, original)
      ;(gl as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
        this.count++
        original(...args)
      }
    }
  }

  reset(): number {
    const prev = this.count
    this.count = 0
    return prev
  }

  destroy(): void {
    const gl = this.gl
    if (!gl) return

    for (const [method, fn] of this.originals) {
      ;(gl as unknown as Record<string, unknown>)[method] = fn
    }
    this.originals.clear()
  }
}
