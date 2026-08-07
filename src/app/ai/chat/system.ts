import type { SceneNode } from '@open-pencil/scene-graph'

import BASE_SYSTEM_PROMPT from '@/app/ai/chat/system-prompt.md?raw'
import { createDeviceSystemPrompt } from '@/app/ai/device/system'
import type { EditorStore } from '@/app/editor/active-store'
import { getActiveEmbeddedDisplayProfile } from '@/features/embedded-display'

export const DESIGN_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT

function topLevelFrameForNode(store: EditorStore, node: SceneNode): SceneNode | undefined {
  const pageId = store.state.currentPageId
  let current: SceneNode | undefined = node
  while (current && current.parentId !== pageId) {
    current = current.parentId ? store.graph.getNode(current.parentId) : undefined
  }
  return current?.type === 'FRAME' ? current : undefined
}

export function resolveDesignTargetFrame(store: EditorStore): SceneNode | undefined {
  const selectedTargets = new Map<string, SceneNode>()
  for (const selected of store.selectedNodes.value) {
    const frame = topLevelFrameForNode(store, selected)
    if (frame) selectedTargets.set(frame.id, frame)
  }
  if (selectedTargets.size === 1) return [...selectedTargets.values()][0]

  const pageFrames = store.graph
    .getChildren(store.state.currentPageId)
    .filter((node) => node.type === 'FRAME')
  return pageFrames.length === 1 ? pageFrames[0] : undefined
}

function roundSafeArea(width: number, height: number): string {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) / 2
  const margin = Math.max(8, Math.round(Math.min(width, height) * 0.035))
  const safeRadius = radius - margin
  const halfSquare = Math.floor(safeRadius / Math.sqrt(2))
  const left = Math.ceil(centerX - halfSquare)
  const top = Math.ceil(centerY - halfSquare)
  const size = halfSquare * 2

  return `Round geometry: center (${centerX}, ${centerY}), physical radius ${radius}. Essential-content safe square with ${margin}px edge margin: x=${left}, y=${top}, w=${size}, h=${size}. Keep every Text, Icon, value, label, and touch target entirely inside that square. Backgrounds and decoration may use the full circular frame. Audit the final JSX bounds before render; no screenshot is required.`
}

export function createDesignContextPrompt(store: EditorStore): string {
  const profile = getActiveEmbeddedDisplayProfile()
  const targetFrame = resolveDesignTargetFrame(store)
  const target = targetFrame
    ? `Current target Frame: "${targetFrame.name}" (${targetFrame.id}), ${Math.round(targetFrame.width)} x ${Math.round(targetFrame.height)}. Preserve it unless the user asks for a new screen.`
    : `No single Frame is selected. New screen size: ${profile.resolution.width} x ${profile.resolution.height}.`
  const shape = profile.visibleArea?.shape ?? 'rectangular'
  const geometry =
    shape === 'round'
      ? `\n${roundSafeArea(profile.resolution.width, profile.resolution.height)}`
      : ''

  return `# OP Embedded Studio target\n\nDevice: ${profile.name} (${profile.id}).\nLogical resolution: ${profile.resolution.width} x ${profile.resolution.height}.\nVisible area: ${shape}. ${profile.visibleArea?.description ?? ''}${geometry}\n${target}\n\nUse the user's language for visible UI text and the final reply. Embedded UI must use clear hierarchy, high contrast, large readable text, and comfortable touch targets. Reference images are visual guidance, not content to describe.`
}

export function createSystemPrompt(store: EditorStore): string {
  return `${DESIGN_SYSTEM_PROMPT}\n\n${createDesignContextPrompt(store)}`
}

export function createUnifiedSystemPrompt(store: EditorStore): string {
  return `${createSystemPrompt(store)}\n\n${createDeviceSystemPrompt(store)}\n\n# Unified assistant workflow\n\nYou are one assistant for the canvas and the connected embedded device. Keep design edits, interaction preparation, previews, and USB deployment in the same conversation. Use design tools when the user asks to create or change the canvas, and use deployment tools when the user asks to prepare or deploy content. Preparation tools only create a confirmation card; hardware is touched only after the user explicitly confirms that card. Do not route requests by keywords or ask the user to switch modes.`
}
