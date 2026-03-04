import { FrameStats } from './frame-stats'
import { GPUTimer } from './gpu-timer'
import { DrawCallCounter } from './draw-call-counter'
import { PhaseTimer } from './phase-timer'
import { HudRenderer } from './hud-renderer'
import { CaptureStack, toSpeedscopeJSON } from './frame-capture'

import type { FrameCapture } from './frame-capture'
import type { CanvasKit, Canvas, Typeface } from 'canvaskit-wasm'

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0

export class RenderProfiler {
  enabled = false
  hudVisible = false
  capturing = false

  readonly stats = new FrameStats()
  readonly phases = new PhaseTimer()
  readonly gpuTimer: GPUTimer
  readonly drawCallCounter: DrawCallCounter

  private hud: HudRenderer | null = null
  private typeface: Typeface | null = null
  private captureStack: CaptureStack | null = null
  private captureFrameStart = 0
  private lastCapture: FrameCapture | null = null
  private renderStartTime = 0

  constructor(
    private ck: CanvasKit,
    gl: WebGL2RenderingContext | null
  ) {
    this.gpuTimer = new GPUTimer(gl)
    this.drawCallCounter = new DrawCallCounter(gl)
  }

  toggle(): void {
    this.hudVisible = !this.hudVisible
    this.enabled = this.hudVisible
    this.phases.enabled = this.enabled
  }

  beginFrame(): void {
    if (!this.enabled) return
    this.renderStartTime = now()
    this.phases.beginPhase('frame')
    this.gpuTimer.beginFrame()
    this.drawCallCounter.reset()
  }

  endFrame(): void {
    if (!this.enabled) return

    this.gpuTimer.endFrame()
    this.gpuTimer.pollResults()

    const cpuTime = now() - this.renderStartTime
    this.stats.gpuTime = this.gpuTimer.lastGpuTimeMs
    this.stats.drawCalls = this.drawCallCounter.count
    this.stats.recordFrame(cpuTime)

    this.phases.endPhase('frame')
  }

  beginPhase(name: string): void {
    if (!this.enabled) return
    this.phases.beginPhase(name)
  }

  endPhase(name: string): void {
    if (!this.enabled) return
    this.phases.endPhase(name)
  }

  setNodeCounts(total: number, culled: number): void {
    this.stats.totalNodes = total
    this.stats.culledNodes = culled
  }

  setCacheHit(hit: boolean): void {
    this.stats.scenePictureCacheHit = hit
  }

  beginCapture(): void {
    this.capturing = true
    this.captureStack = new CaptureStack()
    this.captureFrameStart = now()
    this.captureStack.reset(this.captureFrameStart)
  }

  endCapture(): FrameCapture | null {
    if (!this.capturing || !this.captureStack) return null
    this.capturing = false

    const capture: FrameCapture = {
      timestamp: this.captureFrameStart,
      totalTimeMs: now() - this.captureFrameStart,
      cpuTimeMs: this.stats.cpuTime,
      gpuTimeMs: this.gpuTimer.lastGpuTimeMs,
      totalNodes: this.stats.totalNodes,
      culledNodes: this.stats.culledNodes,
      drawCalls: this.stats.drawCalls,
      scenePictureCacheHit: this.stats.scenePictureCacheHit,
      rootProfiles: this.captureStack.getRootProfiles()
    }

    this.lastCapture = capture
    this.captureStack = null
    return capture
  }

  beginNode(nodeId: string, name: string, type: string, culled: boolean): void {
    this.captureStack?.begin(nodeId, name, type, culled)
  }

  endNode(drawCallsBefore: number): void {
    this.captureStack?.end(this.drawCallCounter.count - drawCallsBefore)
  }

  getLastCapture(): FrameCapture | null {
    return this.lastCapture
  }

  exportSpeedscope(): string | null {
    if (!this.lastCapture) return null
    return toSpeedscopeJSON(this.lastCapture)
  }

  downloadSpeedscope(): void {
    const json = this.exportSpeedscope()
    if (!json || typeof document === 'undefined') return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `openpencil-frame-${Date.now()}.speedscope.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  setTypeface(typeface: Typeface): void {
    this.typeface = typeface
    this.hud?.setTypeface(typeface)
  }

  drawHUD(canvas: Canvas, showRulers: boolean): void {
    if (!this.hudVisible) return
    if (!this.hud) {
      this.hud = new HudRenderer(this.ck)
      if (this.typeface) this.hud.setTypeface(this.typeface)
    }
    this.hud.draw(canvas, this.stats, this.phases.averages, showRulers)
  }

  destroy(): void {
    this.gpuTimer.destroy()
    this.drawCallCounter.destroy()
    this.hud?.destroy()
    this.hud = null
    this.phases.clearPhases()
  }
}
