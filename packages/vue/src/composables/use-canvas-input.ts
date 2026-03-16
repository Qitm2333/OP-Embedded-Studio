import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import {
  AUTO_LAYOUT_BREAK_THRESHOLD,
  PEN_CLOSE_THRESHOLD,
  ROTATION_SNAP_DEGREES,
  DEFAULT_TEXT_WIDTH,
  DEFAULT_TEXT_HEIGHT,
  computeSelectionBounds,
  computeSnap,
  degToRad
} from '@open-pencil/core'

import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/core'

import type { DragDraw, DragMarquee, DragMove, DragPan, DragRotate, DragState } from '../input/types'
import { TOOL_TO_NODE } from '../input/types'
import {
  HANDLE_CURSORS,
  hitTestHandle,
  hitTestCornerRotation,
  cornerRotationCursor
} from '../input/geometry'
import { setupPanZoom } from '../input/pan-zoom'
import { applyResize, tryStartResize } from '../input/resize'
import { computeAutoLayoutIndicator, computeAutoLayoutIndicatorForFrame } from '../input/auto-layout'

export function useCanvasInput(
  canvasRef: Ref<HTMLCanvasElement | null>,
  editor: Editor,
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null,
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null,
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null,
  onCursorMove?: (cx: number, cy: number) => void
) {
  const drag = ref<DragState | null>(null)
  const cursorOverride = ref<string | null>(null)
  let lastClickTime = 0
  let lastClickX = 0
  let lastClickY = 0
  let clickCount = 0
  const MULTI_CLICK_DELAY = 500
  const MULTI_CLICK_RADIUS = 5

  function getCoords(e: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return { sx: 0, sy: 0, cx: 0, cy: 0 }
    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: cx, y: cy } = editor.screenToCanvas(sx, sy)
    return { sx, sy, cx, cy }
  }

  function canvasToLocal(cx: number, cy: number, scopeId: string): { lx: number; ly: number } {
    const node = editor.graph.getNode(scopeId)
    if (!node) return { lx: cx, ly: cy }
    const abs = editor.graph.getAbsolutePosition(scopeId)
    let dx = cx - abs.x
    let dy = cy - abs.y
    if (node.rotation !== 0) {
      const hw = node.width / 2
      const hh = node.height / 2
      const rad = degToRad(-node.rotation)
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const rx = dx - hw
      const ry = dy - hh
      dx = rx * cos - ry * sin + hw
      dy = rx * sin + ry * cos + hh
    }
    return { lx: dx, ly: dy }
  }

  function hitTestInScope(cx: number, cy: number, deep: boolean): SceneNode | null {
    const scopeId = editor.state.enteredContainerId
    if (scopeId) {
      if (!editor.graph.getNode(scopeId)) {
        editor.state.enteredContainerId = null
      } else {
        const { lx, ly } = canvasToLocal(cx, cy, scopeId)
        return deep
          ? editor.graph.hitTestDeep(lx, ly, scopeId)
          : editor.graph.hitTest(lx, ly, scopeId)
      }
    }
    return deep
      ? editor.graph.hitTestDeep(cx, cy, editor.state.currentPageId)
      : editor.graph.hitTest(cx, cy, editor.state.currentPageId)
  }

  function isInsideContainerBounds(cx: number, cy: number, containerId: string): boolean {
    const container = editor.graph.getNode(containerId)
    if (!container) return false
    const { lx, ly } = canvasToLocal(cx, cy, containerId)
    return lx >= 0 && lx <= container.width && ly >= 0 && ly <= container.height
  }

  function startPanDrag(e: MouseEvent) {
    drag.value = {
      type: 'pan',
      startScreenX: e.clientX,
      startScreenY: e.clientY,
      startPanX: editor.state.panX,
      startPanY: editor.state.panY
    }
  }

  function handleTextEditClick(cx: number, cy: number, shiftKey: boolean): boolean {
    const textEd = editor.textEditor
    const editNode = editor.state.editingTextId
      ? editor.graph.getNode(editor.state.editingTextId)
      : null
    if (!textEd || !editNode) {
      editor.commitTextEdit()
      return false
    }
    const abs = editor.graph.getAbsolutePosition(editNode.id)
    const localX = cx - abs.x
    const localY = cy - abs.y
    if (localX < 0 || localY < 0 || localX > editNode.width || localY > editNode.height) {
      editor.commitTextEdit()
      return false
    }
    if (clickCount >= 3) {
      textEd.selectAll()
    } else if (clickCount === 2) {
      textEd.selectWordAt(localX, localY)
    } else {
      textEd.setCursorAt(localX, localY, shiftKey)
      drag.value = { type: 'text-select', startX: cx, startY: cy } as DragState
    }
    editor.requestRender()
    return true
  }

  function tryStartRotation(sx: number, sy: number): boolean {
    if (editor.state.selectedIds.size !== 1) return false
    const id = [...editor.state.selectedIds][0]
    const node = editor.graph.getNode(id)
    if (!node || node.locked) return false
    const abs = editor.graph.getAbsolutePosition(id)
    if (
      !hitTestCornerRotation(
        sx,
        sy,
        abs.x,
        abs.y,
        node.width,
        node.height,
        editor.state.zoom,
        editor.state.panX,
        editor.state.panY,
        node.rotation
      )
    )
      return false

    const screenCx = (abs.x + node.width / 2) * editor.state.zoom + editor.state.panX
    const screenCy = (abs.y + node.height / 2) * editor.state.zoom + editor.state.panY
    const startAngle = Math.atan2(sy - screenCy, sx - screenCx) * (180 / Math.PI)
    drag.value = {
      type: 'rotate',
      nodeId: id,
      centerX: screenCx,
      centerY: screenCy,
      startAngle,
      origRotation: node.rotation
    }
    return true
  }

  function duplicateAndDrag(
    cx: number,
    cy: number
  ): Map<string, { x: number; y: number; parentId: string }> {
    const newIds: string[] = []
    const newOriginals = new Map<string, { x: number; y: number; parentId: string }>()
    for (const id of editor.state.selectedIds) {
      const src = editor.graph.getNode(id)
      if (!src) continue
      const newId = editor.createShape(src.type, src.x, src.y, src.width, src.height)
      editor.graph.updateNode(newId, {
        name: src.name + ' copy',
        fills: [...src.fills],
        strokes: [...src.strokes],
        effects: [...src.effects],
        cornerRadius: src.cornerRadius,
        opacity: src.opacity,
        rotation: src.rotation
      })
      newIds.push(newId)
      const newNode = editor.graph.getNode(newId)
      newOriginals.set(newId, {
        x: src.x,
        y: src.y,
        parentId: newNode?.parentId ?? editor.state.currentPageId
      })
    }
    editor.select(newIds)
    drag.value = {
      type: 'move',
      startX: cx,
      startY: cy,
      originals: newOriginals,
      duplicated: true
    }
    editor.requestRender()
    return newOriginals
  }

  function detectAutoLayoutParent(): string | undefined {
    if (editor.state.selectedIds.size !== 1) return undefined
    const selectedId = [...editor.state.selectedIds][0]
    const selectedNode = editor.graph.getNode(selectedId)
    if (!selectedNode?.parentId) return undefined
    const parent = editor.graph.getNode(selectedNode.parentId)
    if (parent && parent.layoutMode !== 'NONE' && selectedNode.layoutPositioning !== 'ABSOLUTE') {
      return parent.id
    }
    return undefined
  }

  function resolveHit(cx: number, cy: number): SceneNode | null {
    const titleHit =
      hitTestFrameTitle(cx, cy) ?? hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy)
    if (titleHit) return titleHit

    const hit = hitTestInScope(cx, cy, false)
    if (hit) return hit

    const scopeId = editor.state.enteredContainerId
    if (!scopeId) return null

    if (isInsideContainerBounds(cx, cy, scopeId)) {
      editor.clearSelection()
      return null
    }

    editor.exitContainer()
    const afterExit = hitTestInScope(cx, cy, false)
    if (afterExit) return afterExit

    if (editor.state.enteredContainerId) {
      editor.exitContainer()
    }
    return null
  }

  function handleSelectDown(e: MouseEvent, sx: number, sy: number, cx: number, cy: number) {
    if (editor.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

    if (editor.state.editingTextId) editor.commitTextEdit()

    if (tryStartRotation(sx, sy)) return

    const resizeDrag = tryStartResize(sx, sy, cx, cy, editor)
    if (resizeDrag) {
      drag.value = resizeDrag
      return
    }

    const hit = resolveHit(cx, cy)
    if (!hit) {
      if (!editor.state.enteredContainerId) {
        editor.clearSelection()
        drag.value = { type: 'marquee', startX: cx, startY: cy }
      }
      return
    }

    if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey) {
      editor.select([hit.id])
    } else if (e.shiftKey) {
      editor.select([hit.id], true)
    }

    const allLocked = [...editor.state.selectedIds].every((id) => editor.graph.getNode(id)?.locked)
    if (allLocked) return

    const originals = new Map<string, { x: number; y: number; parentId: string }>()
    for (const id of editor.state.selectedIds) {
      const n = editor.graph.getNode(id)
      if (n)
        originals.set(id, { x: n.x, y: n.y, parentId: n.parentId ?? editor.state.currentPageId })
    }

    if (e.altKey && editor.state.selectedIds.size > 0) {
      duplicateAndDrag(cx, cy)
      return
    }

    drag.value = {
      type: 'move',
      startX: cx,
      startY: cy,
      originals,
      autoLayoutParentId: detectAutoLayoutParent()
    }
  }

  function onMouseDown(e: MouseEvent) {
    editor.setHoveredNode(null)
    const { sx, sy, cx, cy } = getCoords(e)

    const now = performance.now()
    if (
      now - lastClickTime < MULTI_CLICK_DELAY &&
      Math.abs(sx - lastClickX) < MULTI_CLICK_RADIUS &&
      Math.abs(sy - lastClickY) < MULTI_CLICK_RADIUS
    ) {
      clickCount++
    } else {
      clickCount = 1
    }
    lastClickTime = now
    lastClickX = sx
    lastClickY = sy
    const tool = editor.state.activeTool

    if (e.button === 1 || tool === 'HAND') {
      startPanDrag(e)
      return
    }

    if (tool === 'SELECT' && e.altKey && !editor.state.selectedIds.size) {
      startPanDrag(e)
      return
    }

    if (tool === 'SELECT') {
      handleSelectDown(e, sx, sy, cx, cy)
      return
    }

    if (tool === 'PEN') {
      editor.penAddVertex(cx, cy)
      drag.value = { type: 'pen-drag', startX: cx, startY: cy } as DragState
      return
    }

    if (tool === 'TEXT') {
      const nodeId = editor.createShape('TEXT', cx, cy, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)
      editor.graph.updateNode(nodeId, { text: '' })
      editor.select([nodeId])
      editor.startTextEditing(nodeId)
      editor.setTool('SELECT')
      editor.requestRender()
      return
    }

    const nodeType = TOOL_TO_NODE[tool]
    if (!nodeType) return

    const nodeId = editor.createShape(nodeType, cx, cy, 0, 0)
    editor.select([nodeId])

    drag.value = { type: 'draw', startX: cx, startY: cy, nodeId }
  }

  function updateHoverCursor(e: MouseEvent) {
    const { sx, sy, cx, cy } = getCoords(e)
    let cursor: string | null = null

    for (const id of editor.state.selectedIds) {
      const node = editor.graph.getNode(id)
      if (!node) continue
      const abs = editor.graph.getAbsolutePosition(id)
      const handle = hitTestHandle(
        sx,
        sy,
        abs.x,
        abs.y,
        node.width,
        node.height,
        editor.state.zoom,
        editor.state.panX,
        editor.state.panY,
        node.rotation
      )
      if (handle) {
        cursor = HANDLE_CURSORS[handle]
        break
      }
    }

    if (!cursor && editor.state.selectedIds.size === 1) {
      const id = [...editor.state.selectedIds][0]
      const node = editor.graph.getNode(id)
      if (node) {
        const abs = editor.graph.getAbsolutePosition(id)
        const corner = hitTestCornerRotation(
          sx,
          sy,
          abs.x,
          abs.y,
          node.width,
          node.height,
          editor.state.zoom,
          editor.state.panX,
          editor.state.panY,
          node.rotation
        )
        if (corner) {
          cursor = cornerRotationCursor(corner, node.rotation)
        }
      }
    }

    cursorOverride.value = cursor

    const hit =
      hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy) ?? hitTestInScope(cx, cy, false)
    editor.setHoveredNode(hit && !editor.state.selectedIds.has(hit.id) ? hit.id : null)
  }

  function handlePanMove(d: DragPan, e: MouseEvent) {
    const dx = e.clientX - d.startScreenX
    const dy = e.clientY - d.startScreenY
    editor.state.panX = d.startPanX + dx
    editor.state.panY = d.startPanY + dy
    editor.requestRepaint()
  }

  function handleRotateMove(d: DragRotate, sx: number, sy: number, shiftKey: boolean) {
    const currentAngle = Math.atan2(sy - d.centerY, sx - d.centerX) * (180 / Math.PI)
    let rotation = d.origRotation + (currentAngle - d.startAngle)

    if (shiftKey) {
      rotation = Math.round(rotation / ROTATION_SNAP_DEGREES) * ROTATION_SNAP_DEGREES
    }

    rotation = ((((rotation + 180) % 360) + 360) % 360) - 180
    editor.setRotationPreview({ nodeId: d.nodeId, angle: rotation })
  }

  function findDropTarget(cx: number, cy: number) {
    let dropTarget = editor.graph.hitTestFrame(
      cx,
      cy,
      editor.state.selectedIds,
      editor.state.currentPageId
    )
    const movingSection = [...editor.state.selectedIds].some(
      (id) => editor.graph.getNode(id)?.type === 'SECTION'
    )
    if (
      movingSection &&
      dropTarget &&
      dropTarget.type !== 'SECTION' &&
      dropTarget.type !== 'CANVAS'
    ) {
      dropTarget = null
    }
    return dropTarget
  }

  function applyMoveSnap(d: DragMove, dx: number, dy: number): { dx: number; dy: number } {
    const selectedNodes: SceneNode[] = []
    for (const [id, orig] of d.originals) {
      const n = editor.graph.getNode(id)
      if (n) {
        const abs = editor.graph.getAbsolutePosition(id)
        const parentAbs = n.parentId ? editor.graph.getAbsolutePosition(n.parentId) : { x: 0, y: 0 }
        selectedNodes.push({
          ...n,
          x: abs.x - parentAbs.x - n.x + orig.x + dx,
          y: abs.y - parentAbs.y - n.y + orig.y + dy
        })
      }
    }

    const bounds = computeSelectionBounds(selectedNodes)
    if (!bounds) return { dx, dy }

    const firstId = [...d.originals.keys()][0]
    const firstNode = editor.graph.getNode(firstId)
    const parentId = firstNode?.parentId ?? editor.state.currentPageId
    const siblings = editor.graph.getChildren(parentId)
    const parentAbs = !editor.isTopLevel(parentId)
      ? editor.graph.getAbsolutePosition(parentId)
      : { x: 0, y: 0 }
    const absTargets = siblings.map((n) => ({
      ...n,
      x: n.x + parentAbs.x,
      y: n.y + parentAbs.y
    }))
    const absBounds = {
      x: bounds.x + parentAbs.x,
      y: bounds.y + parentAbs.y,
      width: bounds.width,
      height: bounds.height
    }
    const snap = computeSnap(editor.state.selectedIds, absBounds, absTargets)
    editor.setSnapGuides(snap.guides)
    return { dx: dx + snap.dx, dy: dy + snap.dy }
  }

  function handleMoveMove(d: DragMove, cx: number, cy: number) {
    let dx = cx - d.startX
    let dy = cy - d.startY

    if (d.autoLayoutParentId && !d.brokeFromAutoLayout) {
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < AUTO_LAYOUT_BREAK_THRESHOLD) {
        computeAutoLayoutIndicator(d, cx, cy, editor)
        return
      }
      d.brokeFromAutoLayout = true
      editor.setLayoutInsertIndicator(null)
    }

    const dropTarget = findDropTarget(cx, cy)
    const dropParent = dropTarget ? editor.graph.getNode(dropTarget.id) : null

    if (dropParent && dropParent.layoutMode !== 'NONE') {
      computeAutoLayoutIndicatorForFrame(dropParent, cx, cy, editor)
      editor.setDropTarget(dropParent.id)
      for (const [id, orig] of d.originals) {
        editor.graph.updateNode(id, {
          x: Math.round(orig.x + dx),
          y: Math.round(orig.y + dy)
        })
      }
      editor.requestRender()
      return
    }

    editor.setLayoutInsertIndicator(null)

    const snapped = applyMoveSnap(d, dx, dy)
    dx = snapped.dx
    dy = snapped.dy

    for (const [id, orig] of d.originals) {
      editor.updateNode(id, { x: Math.round(orig.x + dx), y: Math.round(orig.y + dy) })
    }

    editor.setDropTarget(dropTarget?.id ?? null)
  }

  function handleTextSelectMove(cx: number, cy: number) {
    const textEd = editor.textEditor
    const editNode = editor.state.editingTextId
      ? editor.graph.getNode(editor.state.editingTextId)
      : null
    if (textEd && editNode) {
      const abs = editor.graph.getAbsolutePosition(editNode.id)
      textEd.setCursorAt(cx - abs.x, cy - abs.y, true)
      editor.requestRender()
    }
  }

  function handleDrawMove(d: DragDraw, cx: number, cy: number, shiftKey: boolean) {
    let w = cx - d.startX
    let h = cy - d.startY

    if (shiftKey) {
      const size = Math.max(Math.abs(w), Math.abs(h))
      w = Math.sign(w) * size
      h = Math.sign(h) * size
    }

    editor.updateNode(d.nodeId, {
      x: w < 0 ? d.startX + w : d.startX,
      y: h < 0 ? d.startY + h : d.startY,
      width: Math.abs(w),
      height: Math.abs(h)
    })
  }

  function handleMarqueeMove(d: DragMarquee, cx: number, cy: number) {
    const minX = Math.min(d.startX, cx)
    const minY = Math.min(d.startY, cy)
    const maxX = Math.max(d.startX, cx)
    const maxY = Math.max(d.startY, cy)

    const scopeId = editor.state.enteredContainerId
    const parentId = scopeId ?? editor.state.currentPageId
    const localMin = scopeId ? canvasToLocal(minX, minY, scopeId) : { lx: minX, ly: minY }
    const localMax = scopeId ? canvasToLocal(maxX, maxY, scopeId) : { lx: maxX, ly: maxY }
    const localMinX = Math.min(localMin.lx, localMax.lx)
    const localMinY = Math.min(localMin.ly, localMax.ly)
    const localMaxX = Math.max(localMin.lx, localMax.lx)
    const localMaxY = Math.max(localMin.ly, localMax.ly)

    const hits: string[] = []
    for (const node of editor.graph.getChildren(parentId)) {
      if (!node.visible || node.locked) continue
      if (
        node.x + node.width > localMinX &&
        node.x < localMaxX &&
        node.y + node.height > localMinY &&
        node.y < localMaxY
      ) {
        hits.push(node.id)
      }
    }
    editor.select(hits)
    editor.setMarquee({ x: minX, y: minY, width: maxX - minX, height: maxY - minY })
  }

  function onMouseMove(e: MouseEvent) {
    if (onCursorMove) {
      const { cx, cy } = getCoords(e)
      onCursorMove(cx, cy)
    }

    if (editor.state.activeTool === 'PEN' && editor.state.penState && !drag.value) {
      const { cx, cy } = getCoords(e)
      editor.state.penCursorX = cx
      editor.state.penCursorY = cy

      const first = editor.state.penState.vertices[0]
      if (editor.state.penState.vertices.length > 2) {
        const dist = Math.hypot(cx - first.x, cy - first.y)
        editor.penSetClosingToFirst(dist < PEN_CLOSE_THRESHOLD)
      }
      editor.requestRepaint()
    }

    if (!drag.value && editor.state.activeTool === 'SELECT') {
      updateHoverCursor(e)
    }

    if (!drag.value) return
    const d = drag.value

    if (d.type === 'pan') {
      handlePanMove(d, e)
      return
    }

    const { cx, cy, sx, sy } = getCoords(e)

    if (d.type === 'rotate') {
      handleRotateMove(d, sx, sy, e.shiftKey)
      return
    }
    if (d.type === 'move') {
      handleMoveMove(d, cx, cy)
      return
    }
    if (d.type === 'text-select') {
      handleTextSelectMove(cx, cy)
      return
    }
    if (d.type === 'resize') {
      applyResize(d, cx, cy, e.shiftKey, editor)
      return
    }

    if (d.type === 'pen-drag') {
      const tx = cx - d.startX
      const ty = cy - d.startY
      if (Math.hypot(tx, ty) > 2) {
        editor.penSetDragTangent(tx, ty)
      }
      return
    }

    if (d.type === 'draw') {
      handleDrawMove(d, cx, cy, e.shiftKey)
      return
    }

    handleMarqueeMove(d, cx, cy)
  }

  function handleMoveUp(d: DragMove) {
    const indicator = editor.state.layoutInsertIndicator
    editor.setLayoutInsertIndicator(null)
    editor.setSnapGuides([])

    if (indicator) {
      for (const id of editor.state.selectedIds) {
        editor.reorderInAutoLayout(id, indicator.parentId, indicator.index)
      }
      editor.setDropTarget(null)
      return
    }

    const moved = [...d.originals].some(([id, orig]) => {
      const node = editor.graph.getNode(id)
      return node && (node.x !== orig.x || node.y !== orig.y)
    })

    if (moved) {
      const dropId = editor.state.dropTargetId
      if (dropId) {
        editor.reparentNodes([...editor.state.selectedIds], dropId)
      } else {
        reparentOutsideNodes()
      }
      editor.commitMoveWithReparent(d.originals)
    }
    editor.setDropTarget(null)
  }

  function reparentOutsideNodes() {
    for (const id of editor.state.selectedIds) {
      const node = editor.graph.getNode(id)
      if (!node?.parentId || editor.isTopLevel(node.parentId)) continue
      const parent = editor.graph.getNode(node.parentId)
      if (!parent || (parent.type !== 'FRAME' && parent.type !== 'SECTION')) continue
      const outsideX = node.x + node.width < 0 || node.x > parent.width
      const outsideY = node.y + node.height < 0 || node.y > parent.height
      if (outsideX || outsideY) {
        const grandparentId = parent.parentId ?? editor.state.currentPageId
        editor.graph.reparentNode(id, grandparentId)
      }
    }
  }

  function handleDrawUp(d: DragDraw) {
    const node = editor.graph.getNode(d.nodeId)
    if (node && node.width < 2 && node.height < 2) {
      editor.updateNode(d.nodeId, { width: 100, height: 100 })
    }
    if (node?.type === 'SECTION') {
      editor.adoptNodesIntoSection(node.id)
    }
    editor.setTool('SELECT')
  }

  function onMouseUp() {
    if (!drag.value) return
    const d = drag.value

    if (d.type === 'move') handleMoveUp(d)
    else if (d.type === 'text-select') {
      drag.value = null
      return
    } else if (d.type === 'resize') editor.commitResize(d.nodeId, d.origRect)
    else if (d.type === 'pen-drag') {
      drag.value = null
      return
    } else if (d.type === 'rotate') {
      const preview = editor.state.rotationPreview
      if (preview) {
        editor.updateNode(d.nodeId, { rotation: preview.angle })
        editor.commitRotation(d.nodeId, d.origRotation)
      }
      editor.setRotationPreview(null)
    } else if (d.type === 'draw') handleDrawUp(d)
    else if (d.type === 'marquee') editor.setMarquee(null)

    drag.value = null
    cursorOverride.value = null
  }

  function onDblClick(e: MouseEvent) {
    if (editor.state.editingTextId) return

    const { cx, cy } = getCoords(e)

    const selectedId =
      editor.state.selectedIds.size === 1 ? [...editor.state.selectedIds][0] : undefined
    const selectedNode = selectedId ? editor.graph.getNode(selectedId) : undefined
    const canEnter =
      selectedNode && selectedId && editor.graph.isContainer(selectedId) && !selectedNode.locked

    if (canEnter) {
      editor.enterContainer(selectedId)
      const useDeep = selectedNode.type === 'COMPONENT' || selectedNode.type === 'INSTANCE'
      const hit = hitTestInScope(cx, cy, useDeep)
      if (hit) {
        editor.select([hit.id])
      } else {
        editor.clearSelection()
      }
      return
    }

    const hit =
      hitTestSectionTitle(cx, cy) ?? hitTestComponentLabel(cx, cy) ?? hitTestInScope(cx, cy, true)
    if (!hit) return

    if (hit.type === 'TEXT') {
      editor.select([hit.id])
      editor.startTextEditing(hit.id)
      const textEd = editor.textEditor
      if (textEd) {
        const abs = editor.graph.getAbsolutePosition(hit.id)
        textEd.selectWordAt(cx - abs.x, cy - abs.y)
        editor.requestRender()
      }
      return
    }

    editor.select([hit.id])
  }

  useEventListener(canvasRef, 'dblclick', onDblClick)
  useEventListener(canvasRef, 'mousedown', onMouseDown)
  useEventListener(canvasRef, 'mousemove', onMouseMove)
  useEventListener(canvasRef, 'mouseup', onMouseUp)
  useEventListener(canvasRef, 'mouseleave', () => {
    if (!drag.value) {
      editor.setHoveredNode(null)
    }
  })
  useEventListener(window, 'mouseup', () => {
    if (drag.value) onMouseUp()
  })

  setupPanZoom(canvasRef, editor, drag, onMouseDown, onMouseMove, onMouseUp)

  return {
    drag,
    cursorOverride
  }
}
