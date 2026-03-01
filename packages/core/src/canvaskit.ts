import CanvasKitInit, { type CanvasKit } from 'canvaskit-wasm'

let instance: CanvasKit | null = null

export interface CanvasKitOptions {
  locateFile?: (file: string) => string
}

export async function getCanvasKit(options?: CanvasKitOptions): Promise<CanvasKit> {
  if (instance) return instance
  instance = await CanvasKitInit({
    locateFile:
      options?.locateFile ??
      ((file) => {
        if (typeof window !== 'undefined') return `/${file}`
        return file
      })
  })
  return instance
}
