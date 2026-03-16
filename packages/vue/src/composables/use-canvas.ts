import { useBreakpoints, useRafFn, useResizeObserver } from '@vueuse/core'
import { onMounted, onUnmounted, type Ref } from 'vue'

import { getCanvasKit, getGpuBackend, SkiaRenderer } from '@open-pencil/core'

import type { Editor } from '@open-pencil/core/editor'
import type { CanvasKit } from 'canvaskit-wasm'

interface WebGPUContext {
  device: GPUDevice
  deviceContext: unknown
}

interface CanvasKitWebGPU {
  MakeGPUDeviceContext(device: GPUDevice): unknown
  MakeGPUCanvasContext(ctx: unknown, canvas: HTMLCanvasElement, opts?: unknown): unknown
  MakeGPUCanvasSurface(
    ctx: unknown,
    colorSpace?: unknown,
    width?: number,
    height?: number
  ): ReturnType<CanvasKit['MakeSurface']>
}

function asWebGPU(ck: CanvasKit): CanvasKitWebGPU {
  return ck as unknown as CanvasKitWebGPU
}

async function initWebGPU(ck: CanvasKit): Promise<WebGPUContext | null> {
  if (!('gpu' in navigator)) return null
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) return null
  const device = await adapter.requestDevice()
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- WebGPU CanvasKit API may not exist at runtime
  const deviceContext = asWebGPU(ck).MakeGPUDeviceContext?.(device)
  if (!deviceContext) return null
  return { device, deviceContext }
}

export interface UseCanvasOptions {
  showRulers?: boolean
  preserveDrawingBuffer?: boolean
  onReady?: () => void
}

export function useCanvas(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  options?: UseCanvasOptions
) {
  let renderer: SkiaRenderer | null = null
  let ck: CanvasKit | null = null
  let gpuCtx: WebGPUContext | null = null
  let glContext: ReturnType<CanvasKit['MakeGrContext']> | null = null
  let destroyed = false
  let dirty = true
  let lastRenderVersion = -1
  let lastSelectedIds: Set<string> | null = null

  async function init() {
    const canvas = canvasRef.value
    if (!canvas || destroyed) return

    ck = await getCanvasKit()
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- async race: destroyed may change during await
    if (destroyed) return

    if (getGpuBackend() === 'webgpu') {
      gpuCtx = await initWebGPU(ck)
      if (!gpuCtx) {
        console.warn('WebGPU init failed, reload without ?gpu=webgpu to use WebGL')
        return
      }
    }

    await new Promise((r) => requestAnimationFrame(r))
    createSurface(canvas)
  }

  function sizeCanvas(canvas: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
  }

  function makeGLSurface(canvas: HTMLCanvasElement) {
    if (!ck) return null
    if (!glContext) {
      const glAttrs = options?.preserveDrawingBuffer ? { preserveDrawingBuffer: 1 } : undefined
      const handle = ck.GetWebGLContext(canvas, glAttrs)
      if (!handle) return null
      glContext = ck.MakeGrContext(handle)
    }
    if (!glContext) return null
    return ck.MakeOnScreenGLSurface(glContext, canvas.width, canvas.height, ck.ColorSpace.SRGB)
  }

  function createSurface(canvas: HTMLCanvasElement) {
    if (!ck) return

    renderer?.destroy()
    renderer = null
    glContext?.delete()
    glContext = null

    sizeCanvas(canvas)

    let surface
    if (getGpuBackend() === 'webgpu' && gpuCtx) {
      const gpu = asWebGPU(ck)
      const canvasCtx = gpu.MakeGPUCanvasContext(gpuCtx.deviceContext, canvas)
      surface = gpu.MakeGPUCanvasSurface(canvasCtx, ck.ColorSpace.SRGB, canvas.width, canvas.height)
      if (!surface) {
        console.error('Failed to create WebGPU surface')
        return
      }
    } else {
      surface = makeGLSurface(canvas)
      if (!surface) {
        console.error('Failed to create WebGL surface')
        return
      }
    }

    const glCtx = canvas.getContext('webgl2') ?? null
    renderer = new SkiaRenderer(ck, surface, glCtx)
    editor.setCanvasKit(ck, renderer)
    void renderer.loadFonts().then(() => renderNow())
    renderNow()
    canvas.dataset.ready = '1'
    options?.onReady?.()
  }

  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const noRulersParam = params.has('no-rulers')
  const breakpoints = useBreakpoints({ mobile: 768 })
  const isMobile = breakpoints.smaller('mobile')

  function shouldShowRulers() {
    if (options?.showRulers === false) return false
    return !noRulersParam && !isMobile.value
  }

  function renderNow() {
    if (!renderer || destroyed) return
    renderer.dpr = window.devicePixelRatio || 1
    renderer.panX = editor.state.panX
    renderer.panY = editor.state.panY
    renderer.zoom = editor.state.zoom
    renderer.viewportWidth = canvasRef.value?.clientWidth ?? 0
    renderer.viewportHeight = canvasRef.value?.clientHeight ?? 0
    renderer.showRulers = shouldShowRulers()
    renderer.pageColor = editor.state.pageColor
    renderer.pageId = editor.state.currentPageId
    renderer.render(
      editor.graph,
      editor.state.selectedIds,
      {
        hoveredNodeId: editor.state.hoveredNodeId,
        enteredContainerId: editor.state.enteredContainerId,
        editingTextId: editor.state.editingTextId,
        textEditor: editor.textEditor,
        marquee: editor.state.marquee,
        snapGuides: editor.state.snapGuides,
        rotationPreview: editor.state.rotationPreview,
        dropTargetId: editor.state.dropTargetId,
        layoutInsertIndicator: editor.state.layoutInsertIndicator,
        penState: editor.state.penState
          ? {
              ...editor.state.penState,
              cursorX: editor.state.penCursorX ?? undefined,
              cursorY: editor.state.penCursorY ?? undefined
            }
          : null,
        remoteCursors: editor.state.remoteCursors.length > 0 ? editor.state.remoteCursors : undefined
      },
      editor.state.sceneVersion
    )
    lastRenderVersion = editor.state.renderVersion
    lastSelectedIds = editor.state.selectedIds
  }

  const { pause } = useRafFn(() => {
    if (editor.state.loading) return
    const versionChanged = editor.state.renderVersion !== lastRenderVersion
    const selectionChanged = editor.state.selectedIds !== lastSelectedIds
    if (dirty || versionChanged || selectionChanged) {
      dirty = false
      renderNow()
    }
  })

  onMounted(() => {
    void init()
  })

  onUnmounted(() => {
    destroyed = true
    pause()
    cancelAnimationFrame(resizeRaf)
    renderer?.destroy()
    glContext?.delete()
  })

  let resizeRaf = 0
  useResizeObserver(canvasRef, () => {
    const canvas = canvasRef.value
    if (!canvas || !ck || resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      resizeCanvas(canvas)
    })
  })

  function resizeCanvas(canvas: HTMLCanvasElement) {
    if (!ck || !renderer) {
      createSurface(canvas)
      return
    }

    sizeCanvas(canvas)

    const surface = makeGLSurface(canvas)
    if (!surface) {
      createSurface(canvas)
      return
    }
    renderer.replaceSurface(surface)
    renderNow()
  }

  function hitTestSectionTitle(canvasX: number, canvasY: number) {
    return renderer?.hitTestSectionTitle(editor.graph, canvasX, canvasY) ?? null
  }

  function hitTestComponentLabel(canvasX: number, canvasY: number) {
    return renderer?.hitTestComponentLabel(editor.graph, canvasX, canvasY) ?? null
  }

  function hitTestFrameTitle(canvasX: number, canvasY: number) {
    return (
      renderer?.hitTestFrameTitle(editor.graph, canvasX, canvasY, editor.state.selectedIds) ?? null
    )
  }

  return {
    render: () => {
      dirty = true
    },
    renderNow,
    hitTestSectionTitle,
    hitTestComponentLabel,
    hitTestFrameTitle
  }
}
