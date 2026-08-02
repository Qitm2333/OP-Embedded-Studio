import type { EditorStore } from '@/app/editor/active-store'
import { getDevicePrototypeFrameCandidates } from '@/app/editor/device-prototype'
import { getActiveEmbeddedDisplayProfile } from '@/features/embedded-display'

import { getDesignHandoffMemory, getLatestUsbDeploymentMemory } from './memory'
import DEVICE_SYSTEM_PROMPT from './system-prompt.md?raw'

export function createDeviceSystemPrompt(store: EditorStore): string {
  const profile = getActiveEmbeddedDisplayProfile()
  const memory = getDesignHandoffMemory(store)
  const frame = memory.frame
    ? {
        ...memory.frame,
        recentAI: memory.recentAI
      }
    : null
  const interactionFrames = getDevicePrototypeFrameCandidates(store).map((candidate) => {
    const textSamples = store.graph
      .flattenTree(candidate.id)
      .map(({ node }) =>
        node.type === 'TEXT' && 'characters' in node && typeof node.characters === 'string'
          ? node.characters.trim()
          : ''
      )
      .filter(Boolean)
      .slice(0, 6)
    return {
      id: candidate.id,
      name: candidate.name,
      width: candidate.width,
      height: candidate.height,
      textSamples
    }
  })
  return `${DEVICE_SYSTEM_PROMPT}\n\n# Active device target\n\n${JSON.stringify(
    {
      device: {
        id: profile.id,
        name: profile.name,
        resolution: profile.resolution,
        visibleArea: profile.visibleArea?.shape ?? 'rectangular'
      },
      design: {
        documentName: memory.documentName,
        revision: memory.revision,
        frame,
        interactionFrames
      },
      latestDeployment: getLatestUsbDeploymentMemory(profile.id) ?? null
    },
    null,
    2
  )}`
}
