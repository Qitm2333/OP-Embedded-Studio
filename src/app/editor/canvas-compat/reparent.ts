import type { SceneGraph } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  localRectForWorldCenter,
  matrixHasNonTranslation,
  normalizeRotation,
  parentWorldMatrix,
  worldCenter,
  worldRotation
} from './geometry'

const INSTALLED = Symbol('open-pencil-canvas-compat-reparent')

type PatchedSceneGraph = SceneGraph & { [INSTALLED]?: boolean }

interface WorldGeometry {
  center: Vector
  rotation: number
}

function captureWorldGeometry(graph: SceneGraph, nodeId: string): WorldGeometry | null {
  const node = graph.getNode(nodeId)
  if (!node) return null
  return {
    center: worldCenter(graph, node),
    rotation: worldRotation(graph, node)
  }
}

function restoreWorldGeometry(
  graph: SceneGraph,
  nodeId: string,
  parentId: string,
  geometry: WorldGeometry
): void {
  const node = graph.getNode(nodeId)
  if (!node) return
  const localRect = localRectForWorldCenter(
    graph,
    parentId,
    geometry.center,
    node.width,
    node.height
  )
  if (!localRect) return

  const parent = graph.getNode(parentId)
  const parentRotation = parent ? worldRotation(graph, parent) : 0
  graph.updateNode(nodeId, {
    ...localRect,
    rotation: normalizeRotation(geometry.rotation - parentRotation)
  })
}

export function installReparentCompatibility(graph: SceneGraph): void {
  const patched = graph as PatchedSceneGraph
  if (patched[INSTALLED]) return
  patched[INSTALLED] = true

  const originalReparentNode = graph.reparentNode.bind(graph)
  graph.reparentNode = (nodeId: string, newParentId: string) => {
    const node = graph.getNode(nodeId)
    if (!node || node.parentId === newParentId) {
      originalReparentNode(nodeId, newParentId)
      return
    }

    const oldParentMatrix = parentWorldMatrix(graph, node.parentId)
    const newParentMatrix = parentWorldMatrix(graph, newParentId)
    const needsMatrixCorrection =
      matrixHasNonTranslation(oldParentMatrix) || matrixHasNonTranslation(newParentMatrix)

    if (!needsMatrixCorrection) {
      originalReparentNode(nodeId, newParentId)
      return
    }

    const geometry = captureWorldGeometry(graph, nodeId)
    originalReparentNode(nodeId, newParentId)
    if (geometry) restoreWorldGeometry(graph, nodeId, newParentId, geometry)
  }

  const originalReorderChild = graph.reorderChild.bind(graph)
  graph.reorderChild = (nodeId: string, newParentId: string, insertIndex: number) => {
    const node = graph.getNode(nodeId)
    if (!node || node.parentId === newParentId) {
      originalReorderChild(nodeId, newParentId, insertIndex)
      return
    }

    const geometry = captureWorldGeometry(graph, nodeId)
    originalReorderChild(nodeId, newParentId, insertIndex)
    if (geometry) restoreWorldGeometry(graph, nodeId, newParentId, geometry)
  }
}