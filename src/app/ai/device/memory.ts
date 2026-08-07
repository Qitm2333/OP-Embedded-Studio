import { readCacheJson, writeCacheJson } from '@/app/cache'
import type { EditorStore } from '@/app/editor/active-store'
import {
  getEmbeddedFrameBakeState,
  isEmbeddedVisualSource
} from '@/app/editor/embedded-display-bake'
import {
  rememberUsbFirmwareForPort,
  type EmbeddedFrameBakeState,
  type UsbFrameDeploymentPlan
} from '@/features/embedded-display'

interface RecentAIDesign {
  frameId: string
  frameName: string
  revision: number
  observation: string
  intent: string
  changes: string[]
  updatedAt: number
}

export interface DesignHandoffMemory {
  documentName: string
  revision: number
  frame?: {
    id: string
    name: string
    width: number
    height: number
    layerCount: number
    textSamples: string[]
    source: 'ai-assisted' | 'user-design'
    changedAfterAISummary: boolean
  }
  recentAI?: Omit<RecentAIDesign, 'frameId' | 'frameName' | 'revision'>
}

interface UsbDeploymentMemoryRecord {
  profileId: string
  profileName: string
  protocol: 'OPUSB/1'
  width: number
  height: number
  firmwareVerifiedAt: number
  lastFrameName?: string
  lastFrameRevision?: number
  lastDeployedAt?: number
}

type UsbDeploymentMemory = Partial<Record<string, UsbDeploymentMemoryRecord>>

const USB_DEPLOYMENT_MEMORY_KEY = 'embedded-display/ai-usb-frame-deployments'
const recentDesigns = new WeakMap<EditorStore, RecentAIDesign>()
const latestUsbDeployments = new Map<string, UsbDeploymentMemoryRecord>()

export function recordDesignHandoff(
  store: EditorStore,
  input: Omit<RecentAIDesign, 'revision' | 'updatedAt'>
): void {
  recentDesigns.set(store, {
    ...input,
    revision: store.state.sceneVersion,
    updatedAt: Date.now()
  })
}

export function resolveDesignHandoffFrame(store: EditorStore): EmbeddedFrameBakeState {
  const selected = getEmbeddedFrameBakeState(store)
  if (selected.available) return selected

  const revision = store.state.sceneVersion
  const recent = recentDesigns.get(store)
  const recentFrame = recent ? store.graph.getNode(recent.frameId) : undefined
  if (recentFrame?.type === 'FRAME' && recentFrame.id !== store.graph.rootId) {
    return {
      id: recentFrame.id,
      revision,
      available: true,
      sourceKind: 'frame',
      name: recentFrame.name,
      width: recentFrame.width,
      height: recentFrame.height
    }
  }

  const topLevelFrames = store.graph
    .getChildren(store.state.currentPageId)
    .filter((node) => isEmbeddedVisualSource(node) && node.id !== store.graph.rootId)
  if (topLevelFrames.length === 1) {
    const frame = topLevelFrames[0]
    return {
      id: frame.id,
      revision,
      available: true,
      sourceKind: frame.type === 'FRAME' ? 'frame' : 'image',
      name: frame.name,
      width: frame.width,
      height: frame.height
    }
  }

  return selected
}

export function getDesignHandoffMemory(store: EditorStore): DesignHandoffMemory {
  const bakeState = resolveDesignHandoffFrame(store)
  const recent = recentDesigns.get(store)
  const memory: DesignHandoffMemory = {
    documentName: store.state.documentName,
    revision: store.state.sceneVersion
  }
  if (!bakeState.available) return memory

  const flattened = store.graph.flattenTree(bakeState.id)
  const textSamples = flattened
    .map(({ node }) =>
      node.type === 'TEXT' && 'characters' in node && typeof node.characters === 'string'
        ? node.characters.trim()
        : ''
    )
    .filter(Boolean)
    .slice(0, 8)
  const matchesRecentAI = recent?.frameId === bakeState.id
  memory.frame = {
    id: bakeState.id,
    name: bakeState.name,
    width: bakeState.width,
    height: bakeState.height,
    layerCount: flattened.length,
    textSamples,
    source: matchesRecentAI ? 'ai-assisted' : 'user-design',
    changedAfterAISummary: matchesRecentAI && recent.revision !== bakeState.revision
  }
  if (matchesRecentAI) {
    memory.recentAI = {
      observation: recent.observation,
      intent: recent.intent,
      changes: recent.changes,
      updatedAt: recent.updatedAt
    }
  }
  return memory
}

async function readUsbDeploymentMemory(): Promise<UsbDeploymentMemory> {
  return (await readCacheJson<UsbDeploymentMemory>(USB_DEPLOYMENT_MEMORY_KEY)) ?? {}
}

export async function rememberUsbFirmware(plan: UsbFrameDeploymentPlan): Promise<void> {
  rememberUsbFirmwareForPort(plan.profileId)
  const memory = await readUsbDeploymentMemory()
  const previous = memory[plan.profileId]
  memory[plan.profileId] = {
    ...previous,
    profileId: plan.profileId,
    profileName: plan.profileName,
    protocol: 'OPUSB/1',
    width: plan.resolution.width,
    height: plan.resolution.height,
    firmwareVerifiedAt: Date.now()
  }
  const updated = memory[plan.profileId]
  if (updated) latestUsbDeployments.set(plan.profileId, updated)
  await writeCacheJson(USB_DEPLOYMENT_MEMORY_KEY, memory)
}

export async function rememberUsbDeployment(plan: UsbFrameDeploymentPlan): Promise<void> {
  const memory = await readUsbDeploymentMemory()
  const previous = memory[plan.profileId]
  memory[plan.profileId] = {
    ...previous,
    profileId: plan.profileId,
    profileName: plan.profileName,
    protocol: 'OPUSB/1',
    width: plan.resolution.width,
    height: plan.resolution.height,
    firmwareVerifiedAt: previous?.firmwareVerifiedAt ?? Date.now(),
    lastFrameName: plan.frame.name,
    lastFrameRevision: plan.frame.revision,
    lastDeployedAt: Date.now()
  }
  const updated = memory[plan.profileId]
  if (updated) latestUsbDeployments.set(plan.profileId, updated)
  await writeCacheJson(USB_DEPLOYMENT_MEMORY_KEY, memory)
}

export function getLatestUsbDeploymentMemory(
  profileId: string
): UsbDeploymentMemoryRecord | undefined {
  return latestUsbDeployments.get(profileId)
}
