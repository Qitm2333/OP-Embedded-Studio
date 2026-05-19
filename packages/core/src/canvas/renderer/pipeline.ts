import type { Canvas } from 'canvaskit-wasm'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import type { EditorState } from '#core/editor/types'
import { computeDescendantVisualBounds } from '#core/geometry'
import type { SceneGraph } from '#core/scene-graph'

export function renderSceneToCanvas(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  pageId: string
): void {
  const prevViewport = r.worldViewport
  r.worldViewport = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 }
  const pageNode = graph.getNode(pageId)
  if (pageNode) {
    for (const childId of pageNode.childIds) {
      r.renderNode(canvas, graph, childId, {})
    }
  }
  r.worldViewport = prevViewport
}

export type RenderLayer = 'full' | 'scene' | 'overlays'

export function renderFromEditorState(
  r: SkiaRenderer,
  state: EditorState,
  graph: SceneGraph,
  textEditor: unknown,
  viewportWidth: number,
  viewportHeight: number,
  showRulers = true,
  dpr = 1,
  layer: RenderLayer = 'full'
): void {
  r.dpr = dpr
  r.panX = state.panX
  r.panY = state.panY
  r.zoom = state.zoom
  r.viewportWidth = viewportWidth
  r.viewportHeight = viewportHeight
  r.showRulers = showRulers
  r.pageColor = state.pageColor
  r.rulerTheme = state.rulerTheme ?? null
  r.pageId = state.currentPageId
  render(
    r,
    graph,
    state.selectedIds,
    {
      hoveredNodeId: state.hoveredNodeId,
      enteredContainerId: state.enteredContainerId,
      editingTextId: state.editingTextId,
      textEditor: textEditor as RenderOverlays['textEditor'],
      marquee: state.marquee,
      snapGuides: state.snapGuides,
      rotationPreview: state.rotationPreview,
      dropTargetId: state.dropTargetId,
      layoutInsertIndicator: state.layoutInsertIndicator,
      penState: state.penState
        ? ({
            ...state.penState,
            cursorX: state.penCursorX ?? undefined,
            cursorY: state.penCursorY ?? undefined
          } as RenderOverlays['penState'])
        : null,
      nodeEditState: state.nodeEditState ?? null,
      remoteCursors: state.remoteCursors,
      autoLayoutHover: state.autoLayoutHover
    },
    state.sceneVersion,
    layer
  )
}

function hasVolatileOverlay(overlays: RenderOverlays): boolean {
  return (
    overlays.dropTargetId != null ||
    overlays.rotationPreview != null ||
    overlays.editingTextId != null ||
    overlays.nodeEditState != null
  )
}

function scenePictureMissReason(
  r: SkiaRenderer,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  hasPositionPreview: boolean
): string {
  if (hasPositionPreview) return 'position-preview'
  if (hasVolatileOverlay(overlays)) return 'volatile-overlay'
  if (!r.scenePicture) return 'missing-picture'
  if (graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion)
    return 'position-preview-version'
  if (sceneVersion !== r.scenePictureVersion) return 'scene-version'
  if (r.pageId !== r.scenePicturePageId) return 'page'
  return 'unknown'
}

function canUseScenePicture(
  r: SkiaRenderer,
  graph: SceneGraph,
  sceneVersion: number,
  hasVolatileOverlays: boolean
): boolean {
  return (
    !hasVolatileOverlays &&
    !!r.scenePicture &&
    graph.positionPreviewVersion === r.scenePicturePositionPreviewVersion &&
    sceneVersion === r.scenePictureVersion &&
    r.pageId === r.scenePicturePageId
  )
}

const now = typeof performance !== 'undefined' ? () => performance.now() : () => 0
const SCENE_BACKING_SCALE = 3
const SCENE_BACKING_PREVIEW_IDLE_MS = 180

function measure<T>(fn: () => T): { value: T; duration: number } {
  const start = now()
  const value = fn()
  return { value, duration: now() - start }
}

export function render(
  r: SkiaRenderer,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays = {},
  sceneVersion = -1,
  layer: RenderLayer = 'full'
): void {
  const p = r.profiler
  p.beginFrame()
  p.setScenePictureDrawTime(0)
  p.setScenePictureRecordTime(0)
  p.setFlushTime(0)

  graph.clearAbsPosCache()

  const canvas = r.surface.getCanvas()
  if (layer === 'overlays') {
    canvas.clear(r.ck.Color4f(0, 0, 0, 0))
  } else {
    canvas.clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
  }

  r.worldViewport = {
    x: -r.panX / r.zoom,
    y: -r.panY / r.zoom,
    w: r.viewportWidth / r.zoom,
    h: r.viewportHeight / r.zoom
  }
  updateSceneBackingPreviewState(r, layer)

  const hasPositionPreview =
    graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion &&
    sceneVersion === r.scenePictureVersion
  const hasVolatileOverlays = hasPositionPreview || hasVolatileOverlay(overlays)

  const canUsePicture = canUseScenePicture(r, graph, sceneVersion, hasVolatileOverlays)
  const cacheMissReason = scenePictureMissReason(
    r,
    graph,
    overlays,
    sceneVersion,
    hasPositionPreview
  )

  if (layer !== 'overlays') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)

    p.beginPhase('render:scene')
    if (layer === 'scene' && renderSceneBacking(r, canvas, graph, sceneVersion)) {
      p.setScenePictureMode('hit', 'backing')
    } else {
      canvas.translate(r.panX, r.panY)
      canvas.scale(r.zoom, r.zoom)
      renderSceneContent(
        r,
        canvas,
        graph,
        overlays,
        sceneVersion,
        canUsePicture,
        cacheMissReason,
        hasVolatileOverlays
      )
    }
    p.endPhase('render:scene')

    canvas.restore()
  }

  if (layer !== 'scene') {
    canvas.save()
    canvas.scale(r.dpr, r.dpr)
    r.labelCache.update(graph, r.pageId, sceneVersion, graph.positionPreviewVersion)
    p.beginPhase('render:sectionTitles')
    r.drawSectionTitles(canvas, graph)
    p.endPhase('render:sectionTitles')
    p.beginPhase('render:componentLabels')
    r.drawComponentLabels(canvas, graph)
    p.endPhase('render:componentLabels')
    canvas.restore()

    canvas.save()
    canvas.scale(r.dpr, r.dpr)

    r.drawHoverHighlight(
      canvas,
      graph,
      overlays.hoveredNodeId === overlays.nodeEditState?.nodeId ? null : overlays.hoveredNodeId
    )
    r.drawEnteredContainer(canvas, graph, overlays.enteredContainerId)
    p.beginPhase('render:selection')
    r.drawSelection(canvas, graph, selectedIds, overlays)
    p.endPhase('render:selection')
    r.drawFlashes(canvas, graph)
    r.drawSnapGuides(canvas, overlays.snapGuides)
    r.drawMarquee(canvas, overlays.marquee)
    r.drawLayoutInsertIndicator(canvas, overlays.layoutInsertIndicator)
    r.drawAutoLayoutHover(canvas, graph, overlays.autoLayoutHover)
    r.drawNodeEditOverlay(canvas, graph, overlays.nodeEditState)
    r.drawPenOverlay(canvas, overlays.penState)
    r.drawRemoteCursors(canvas, graph, overlays.remoteCursors)
    p.beginPhase('render:rulers')
    if (r.showRulers) r.drawRulers(canvas, graph, selectedIds)
    p.endPhase('render:rulers')

    p.drawHUD(canvas, r.showRulers)

    canvas.restore()
  }

  p.beginPhase('render:flush')
  const { duration: flushDuration } = measure(() => r.surface.flush())
  p.setFlushTime(flushDuration)
  p.endPhase('render:flush')

  p.setNodeCounts(r._nodeCount, r._culledCount)
  p.endFrame()
}

function updateSceneBackingPreviewState(r: SkiaRenderer, layer: RenderLayer): void {
  if (layer !== 'scene') return
  const previous = r.lastSceneViewport
  const viewportChanged =
    !previous ||
    previous.panX !== r.panX ||
    previous.panY !== r.panY ||
    previous.zoom !== r.zoom
  if (viewportChanged) {
    r.sceneBackingPreviewUntil = now() + SCENE_BACKING_PREVIEW_IDLE_MS
    r.sceneBackingNeedsCrispRender = !!r.sceneBacking
    r.lastSceneViewport = { panX: r.panX, panY: r.panY, zoom: r.zoom }
  }
}

function backingCoverageContainsLiveViewport(
  r: SkiaRenderer,
  sceneVersion: number,
  allowStaleZoom: boolean
): boolean {
  const backing = r.sceneBacking
  if (!backing) return false
  if (backing.pageId !== r.pageId) return false
  if (backing.sceneVersion !== sceneVersion) return false
  if (backing.positionPreviewVersion !== r.scenePicturePositionPreviewVersion) return false
  if (!allowStaleZoom && Math.abs(backing.zoom - r.zoom) > 0.0001) return false

  const liveX = -r.panX / r.zoom
  const liveY = -r.panY / r.zoom
  const liveW = r.viewportWidth / r.zoom
  const liveH = r.viewportHeight / r.zoom
  return (
    liveX >= backing.worldX &&
    liveY >= backing.worldY &&
    liveX + liveW <= backing.worldX + backing.worldWidth &&
    liveY + liveH <= backing.worldY + backing.worldHeight
  )
}

function drawSceneBacking(
  r: SkiaRenderer,
  canvas: Canvas,
  sceneVersion: number,
  allowStaleZoom: boolean
): boolean {
  const backing = r.sceneBacking
  if (!backing || !backingCoverageContainsLiveViewport(r, sceneVersion, allowStaleZoom)) return false

  const scale = r.zoom / backing.zoom
  const x = r.panX - backing.panX * scale
  const y = r.panY - backing.panY * scale
  r.opacityPaint.setAlphaf(1)
  canvas.drawImageRect(
    backing.image,
    r.ck.LTRBRect(0, 0, backing.width * backing.dpr, backing.height * backing.dpr),
    r.ck.LTRBRect(x, y, x + backing.width * scale, y + backing.height * scale),
    r.opacityPaint,
    true
  )
  return true
}

function recordSceneBacking(r: SkiaRenderer, graph: SceneGraph, sceneVersion: number): void {
  const marginX = r.viewportWidth * ((SCENE_BACKING_SCALE - 1) / 2)
  const marginY = r.viewportHeight * ((SCENE_BACKING_SCALE - 1) / 2)
  const width = Math.max(1, Math.ceil(r.viewportWidth + marginX * 2))
  const height = Math.max(1, Math.ceil(r.viewportHeight + marginY * 2))
  const surface = r.surface.makeSurface({
    width: Math.ceil(width * r.dpr),
    height: Math.ceil(height * r.dpr),
    colorType: r.ck.ColorType.RGBA_8888,
    alphaType: r.ck.AlphaType.Premul,
    colorSpace: r.ck.ColorSpace.SRGB
  })
  const canvas = surface.getCanvas()
  canvas.clear(r.ck.Color4f(r.pageColor.r, r.pageColor.g, r.pageColor.b, 1))
  canvas.save()
  canvas.scale(r.dpr, r.dpr)
  const backingPanX = r.panX + marginX
  const backingPanY = r.panY + marginY
  const prevViewport = r.worldViewport
  r.worldViewport = {
    x: -backingPanX / r.zoom,
    y: -backingPanY / r.zoom,
    w: width / r.zoom,
    h: height / r.zoom
  }
  canvas.translate(backingPanX, backingPanY)
  canvas.scale(r.zoom, r.zoom)
  renderPageChildren(r, canvas, graph, {})
  canvas.restore()
  surface.flush()
  const image = surface.makeImageSnapshot()
  surface.delete()
  r.worldViewport = prevViewport

  r.sceneBacking?.image.delete()
  r.sceneBacking = {
    image,
    pageId: r.pageId,
    sceneVersion,
    positionPreviewVersion: graph.positionPreviewVersion,
    panX: backingPanX,
    panY: backingPanY,
    zoom: r.zoom,
    width,
    height,
    dpr: r.dpr,
    worldX: -backingPanX / r.zoom,
    worldY: -backingPanY / r.zoom,
    worldWidth: width / r.zoom,
    worldHeight: height / r.zoom
  }
  r.scenePictureVersion = sceneVersion
  r.scenePicturePositionPreviewVersion = graph.positionPreviewVersion
  r.scenePicturePageId = r.pageId
  r.sceneBackingNeedsCrispRender = false
}

function renderSceneBacking(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  sceneVersion: number
): boolean {
  const allowStaleZoom = now() < r.sceneBackingPreviewUntil
  if (!backingCoverageContainsLiveViewport(r, sceneVersion, allowStaleZoom)) {
    recordSceneBacking(r, graph, sceneVersion)
  }
  const crisp = Math.abs((r.sceneBacking?.zoom ?? r.zoom) - r.zoom) <= 0.0001
  r.sceneBackingNeedsCrispRender = !crisp
  return drawSceneBacking(r, canvas, sceneVersion, allowStaleZoom)
}

function renderSceneContent(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays,
  sceneVersion: number,
  canUsePicture: boolean,
  cacheMissReason: string,
  hasVolatileOverlays: boolean
): void {
  const p = r.profiler
  if (canUsePicture) {
    p.setScenePictureMode('hit')
    p.beginPhase('render:drawPicture')
    if (r.scenePicture) {
      const picture = r.scenePicture
      const { duration } = measure(() => canvas.drawPicture(picture))
      p.setScenePictureDrawTime(duration)
    }
    p.endPhase('render:drawPicture')
  } else if (hasVolatileOverlays) {
    p.setScenePictureMode('volatile', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    p.beginPhase('render:volatile')
    renderPageChildren(r, canvas, graph, overlays)
    p.endPhase('render:volatile')
  } else {
    p.setScenePictureMode('record', cacheMissReason)
    r._nodeCount = 0
    r._culledCount = 0
    p.beginPhase('render:recordPicture')
    const { duration } = measure(() => recordScenePicture(r, canvas, graph, sceneVersion))
    p.setScenePictureRecordTime(duration)
    p.endPhase('render:recordPicture')
  }
}

function renderPageChildren(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  overlays: RenderOverlays
): void {
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  if (!pageNode) return
  for (const childId of pageNode.childIds) {
    r.renderNode(canvas, graph, childId, overlays)
  }
}

function recordScenePicture(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  sceneVersion: number
): void {
  r.scenePicture?.delete()
  const prevViewport = r.worldViewport
  r.worldViewport = { x: -1e6, y: -1e6, w: 2e6, h: 2e6 }
  const recorder = new r.ck.PictureRecorder()
  const pageNode = graph.getNode(r.pageId ?? graph.rootId)
  const sceneContentBounds = pageNode
    ? computeDescendantVisualBounds(
        pageNode.childIds,
        (id) => graph.getNode(id),
        (id) => graph.getAbsolutePosition(id)
      )
    : null
  const sceneBounds = sceneContentBounds
    ? {
        x: sceneContentBounds.minX,
        y: sceneContentBounds.minY,
        width: sceneContentBounds.maxX - sceneContentBounds.minX,
        height: sceneContentBounds.maxY - sceneContentBounds.minY
      }
    : { x: 0, y: 0, width: 1, height: 1 }
  const padding = 1024
  const bounds = r.ck.LTRBRect(
    sceneBounds.x - padding,
    sceneBounds.y - padding,
    sceneBounds.x + sceneBounds.width + padding,
    sceneBounds.y + sceneBounds.height + padding
  )
  const recCanvas = recorder.beginRecording(bounds)
  if (pageNode) {
    for (const childId of pageNode.childIds) {
      r.renderNode(recCanvas, graph, childId, {})
    }
  }
  r.scenePicture = recorder.finishRecordingAsPicture()
  recorder.delete()
  r.worldViewport = prevViewport
  r.scenePictureVersion = sceneVersion
  r.scenePicturePositionPreviewVersion = graph.positionPreviewVersion
  r.scenePicturePageId = r.pageId
  canvas.drawPicture(r.scenePicture)
}
