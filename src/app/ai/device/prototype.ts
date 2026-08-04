import { markRaw, reactive } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'
import {
  bakeDevicePrototype,
  getDevicePrototypeFrameCandidates
} from '@/app/editor/device-prototype'
import {
  type DevicePrototypeDefinition,
  type DevicePrototypeEventId,
  type DevicePrototypeInteraction,
  useDevicePrototype
} from '@/features/device-prototype'
import {
  cancelUsbFrameDeployment,
  executeUsbFrameDeployment,
  getActiveEmbeddedDisplayProfile,
  getUsbFrameDeploymentPlan,
  isUsbFrameDeploymentBusy,
  prepareUsbPrototypeDeployment,
  supersedeUsbFrameDeployment,
  type UsbFrameDeploymentPlan
} from '@/features/embedded-display'

import { hasUsbFirmwareMemory, rememberUsbDeployment, rememberUsbFirmware } from './memory'

export interface DevicePrototypeTransitionInput {
  fromFrameId: string
  event: DevicePrototypeEventId
  toFrameId: string
}

export interface PrepareDevicePrototypeProposalInput {
  intent: string
  name: string
  frameIds: string[]
  initialFrameId: string
  transitions: DevicePrototypeTransitionInput[]
  backgroundColor?: string
}

export type DevicePrototypeProposalStatus =
  | 'ready'
  | 'preparing'
  | 'deployment-ready'
  | 'error'
  | 'stale'
  | 'cancelled'
  | 'superseded'

export interface DevicePrototypeProposal {
  id: string
  status: DevicePrototypeProposalStatus
  intent: string
  name: string
  revision: number
  definition: DevicePrototypeDefinition
  profileId: string
  profileName: string
  resolution: { width: number; height: number }
  roundScreen: boolean
  backgroundColor: string
  interactionId?: string
  deploymentPlanId?: string
  message: string
  error?: string
  createdAt: number
}

interface DevicePrototypeProposalRecord extends DevicePrototypeProposal {
  store: EditorStore
}

const proposals = reactive(new Map<string, DevicePrototypeProposalRecord>())

function interactionFingerprint(interaction: DevicePrototypeInteraction): string {
  return JSON.stringify({
    initialStateId: interaction.initialStateId,
    states: interaction.states,
    transitions: interaction.transitions
  })
}

function proposalInteraction(
  proposal: DevicePrototypeProposalRecord
): DevicePrototypeInteraction | null {
  if (!proposal.interactionId) return null
  return (
    useDevicePrototype().interactions.value.find(
      (interaction) => interaction.id === proposal.interactionId
    ) ?? null
  )
}

function supersedeInactiveProposals(): void {
  for (const proposal of proposals.values()) {
    if (proposal.status === 'preparing') continue
    const deployment = proposal.deploymentPlanId
      ? getUsbFrameDeploymentPlan(proposal.deploymentPlanId)
      : undefined
    if (deployment?.status === 'success') continue
    if (deployment && isUsbFrameDeploymentBusy(deployment.status)) continue
    if (proposal.deploymentPlanId) supersedeUsbFrameDeployment(proposal.deploymentPlanId)
    proposal.status = 'superseded'
    proposal.error = undefined
    proposal.message = '已由新的交互烧录计划替代'
  }
}

function validateProposalInput(
  store: EditorStore,
  input: PrepareDevicePrototypeProposalInput
): DevicePrototypeDefinition {
  if (input.transitions.length === 0) throw new Error('交互至少需要一条事件跳转')
  const candidates = new Map(
    getDevicePrototypeFrameCandidates(store).map((candidate) => [candidate.id, candidate])
  )
  const frameIds = [...new Set(input.frameIds)]
  if (frameIds.length < 2) throw new Error('至少需要两个 Frame 才能创建交互')
  if (frameIds.length > 10) throw new Error('一次交互最多支持 10 个 Frame')
  if (!frameIds.includes(input.initialFrameId)) throw new Error('初始 Frame 不在交互状态中')

  const states = frameIds.map((frameId) => {
    const frame = candidates.get(frameId)
    if (!frame) throw new Error(`Frame 不存在或不在当前页面：${frameId}`)
    return {
      id: frame.id,
      frameId: frame.id,
      name: frame.name,
      width: frame.width,
      height: frame.height
    }
  })
  const stateIds = new Set(frameIds)
  const transitionKeys = new Set<string>()
  const transitions = input.transitions.map((transition) => {
    if (!stateIds.has(transition.fromFrameId) || !stateIds.has(transition.toFrameId)) {
      throw new Error('交互跳转引用了未选中的 Frame')
    }
    const key = `${transition.fromFrameId}:${transition.event}`
    if (transitionKeys.has(key)) throw new Error('同一 Frame 的同一事件只能设置一个目标')
    transitionKeys.add(key)
    return {
      fromStateId: transition.fromFrameId,
      event: transition.event,
      toStateId: transition.toFrameId
    }
  })

  return { initialStateId: input.initialFrameId, states, transitions }
}

export function getDevicePrototypeProposal(id: string): DevicePrototypeProposal | undefined {
  return proposals.get(id)
}

export function prepareDevicePrototypeProposal(
  store: EditorStore,
  input: PrepareDevicePrototypeProposalInput
): DevicePrototypeProposal {
  const name = input.name.trim()
  if (!name) throw new Error('交互名称不能为空')
  const definition = validateProposalInput(store, input)
  supersedeInactiveProposals()
  const profile = getActiveEmbeddedDisplayProfile()
  const id = globalThis.crypto.randomUUID()
  const proposal = reactive<DevicePrototypeProposalRecord>({
    id,
    status: 'ready',
    intent: input.intent,
    name,
    revision: store.state.sceneVersion,
    definition,
    profileId: profile.id,
    profileName: profile.name,
    resolution: { ...profile.resolution },
    roundScreen: profile.visibleArea?.shape === 'round',
    backgroundColor: input.backgroundColor ?? '#000000',
    message: '交互方案已准备，确认后会添加到交互栏',
    createdAt: Date.now(),
    store: markRaw(store)
  })
  proposals.set(id, proposal)
  return proposal
}

export async function confirmDevicePrototypeProposalFromChat(id: string): Promise<boolean> {
  const proposal = proposals.get(id)
  if (
    !proposal ||
    proposal.status === 'cancelled' ||
    proposal.status === 'superseded' ||
    proposal.status === 'preparing'
  ) {
    return false
  }
  proposal.status = 'preparing'
  proposal.error = undefined
  proposal.message = '正在创建交互并准备烧录内容'

  try {
    const activeProfile = getActiveEmbeddedDisplayProfile()
    if (
      proposal.store.state.sceneVersion !== proposal.revision ||
      activeProfile.id !== proposal.profileId
    ) {
      if (proposal.deploymentPlanId) cancelUsbFrameDeployment(proposal.deploymentPlanId)
      proposal.deploymentPlanId = undefined
      proposal.revision = proposal.store.state.sceneVersion
      proposal.profileId = activeProfile.id
      proposal.profileName = activeProfile.name
      proposal.resolution = { ...activeProfile.resolution }
      proposal.roundScreen = activeProfile.visibleArea?.shape === 'round'
      proposal.message = '画布或目标屏幕已更新，正在重新准备当前交互'
    }

    let interaction = proposalInteraction(proposal)
    if (!interaction) {
      interaction = useDevicePrototype().createInteractionFromDefinition({
        name: proposal.name,
        definition: proposal.definition
      })
      proposal.interactionId = interaction.id
    }

    const bake = await bakeDevicePrototype(proposal.store, interaction)
    const initialState = interaction.states.find((state) => state.id === interaction.initialStateId)
    if (!initialState) throw new Error('交互缺少有效的初始 Frame')
    const profile = getActiveEmbeddedDisplayProfile()
    const plan = await prepareUsbPrototypeDeployment({
      profile,
      frame: {
        id: initialState.frameId,
        name: initialState.name,
        revision: proposal.revision,
        width: initialState.width,
        height: initialState.height
      },
      bake,
      backgroundColor: proposal.backgroundColor,
      firstDeployment: !(await hasUsbFirmwareMemory(profile.id))
    })
    proposal.deploymentPlanId = plan.id
    proposal.status = 'deployment-ready'
    proposal.message = '新交互已添加到交互栏，烧录内容已准备'
    return true
  } catch (error) {
    proposal.status = 'error'
    proposal.error = error instanceof Error ? error.message : String(error)
    proposal.message = proposal.error
    return false
  }
}

export async function executeDevicePrototypeDeploymentFromChat(
  proposalId: string,
  authorizeFirmwareInitialization = false
): Promise<boolean> {
  const proposal = proposals.get(proposalId)
  const planId = proposal?.deploymentPlanId
  if (!proposal || !planId) return false

  const expectedInteraction = proposalInteraction(proposal)
  const expectedFingerprint = expectedInteraction
    ? interactionFingerprint(expectedInteraction)
    : undefined
  return executeUsbFrameDeployment(planId, {
    authorizeFirmwareInitialization,
    isSnapshotCurrent: () => {
      const interaction = proposalInteraction(proposal)
      return (
        proposal.store.state.sceneVersion === proposal.revision &&
        getActiveEmbeddedDisplayProfile().id === proposal.profileId &&
        Boolean(
          interaction &&
          expectedFingerprint &&
          interactionFingerprint(interaction) === expectedFingerprint
        )
      )
    },
    onFirmwareVerified: rememberUsbFirmware,
    onSuccess: rememberUsbDeployment
  })
}

export function cancelDevicePrototypeProposalFromChat(id: string): void {
  const proposal = proposals.get(id)
  if (!proposal || proposal.status === 'preparing' || proposal.status === 'superseded') return
  if (proposal.deploymentPlanId) cancelUsbFrameDeployment(proposal.deploymentPlanId)
  if (proposal.interactionId) {
    proposal.status = 'error'
    proposal.message = '烧录已取消，已经创建的交互仍保留在交互栏'
  } else {
    proposal.status = 'cancelled'
    proposal.message = '交互方案已取消，未修改交互栏或设备'
  }
}

export function getDevicePrototypeDeploymentPlan(
  proposalId: string
): UsbFrameDeploymentPlan | undefined {
  const planId = proposals.get(proposalId)?.deploymentPlanId
  if (!planId) return undefined
  return getUsbFrameDeploymentPlan(planId)
}
