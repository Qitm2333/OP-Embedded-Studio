import { markRaw, reactive } from 'vue'

import { embeddedManifestUrl } from '../adapters/http'
import {
  imageFileToRgb565,
  prototypeBakeToRgb565,
  type EmbeddedImagePlacement
} from '../adapters/image'
import {
  flashUsbFrameFirmware,
  flashUsbPrototypeFirmware,
  flashUsbSequenceFirmware,
  requestUsbSerialPort,
  supportsUsbFrameFastFlash,
  type UsbFlashOptions,
  type UsbSerialPort
} from '../adapters/usb-content'
import {
  getSingleAuthorizedUsbContentPort,
  transferUsbContentWithFirmwareFallback
} from '../adapters/usb-content-firmware'
import type { UsbContentSerialPort } from '../adapters/usb-content-transfer'
import { imageFilesToUsbSequence, type UsbImageSequencePayload } from '../adapters/usb-sequence'
import { encodeWirelessImage, encodeWirelessPrototype } from '../adapters/wireless-content'
import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedPrototypeBakeResult,
  EmbeddedPrototypePayload
} from '../model/types'

export type UsbFrameDeploymentStatus =
  | 'ready'
  | 'selecting-device'
  | 'checking-firmware'
  | 'flashing-firmware'
  | 'reconnecting'
  | 'transferring-content'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'stale'
  | 'superseded'

export type UsbFrameDeploymentStageStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error'

export interface UsbFrameDeploymentFrame {
  id: string
  name: string
  revision: number
  width: number
  height: number
}

export interface UsbFrameDeploymentPlan {
  id: string
  mode: 'frame' | 'prototype' | 'slideshow'
  status: UsbFrameDeploymentStatus
  profileId: string
  profileName: string
  resolution: { width: number; height: number }
  roundScreen: boolean
  frame: UsbFrameDeploymentFrame
  prototype?: {
    id: string
    name: string
    stateCount: number
    transitionCount: number
    stateNames: string[]
  }
  backgroundColor: string
  placement: EmbeddedImagePlacement
  previewUrl: string
  contentBytes: number
  firstDeployment: boolean
  needsDeviceSelection: boolean
  firmwareVerified: boolean
  firmwareCapacity?: number
  progress: number
  message: string
  error?: string
  firmwareStage: UsbFrameDeploymentStageStatus
  contentStage: UsbFrameDeploymentStageStatus
  logs: string[]
  createdAt: number
  completedAt?: number
}

type DeploymentSerialPort = UsbContentSerialPort

interface UsbFrameDeploymentRecord extends UsbFrameDeploymentPlan {
  payload?: EmbeddedImagePayload | EmbeddedPrototypePayload | UsbImageSequencePayload
  source?: UsbFrameDeploymentSource
  port?: DeploymentSerialPort
  manifestUrl: string
}

type UsbFrameDeploymentSource =
  | {
      kind: 'frame'
      profile: EmbeddedDisplayProfile
      file: File
    }
  | {
      kind: 'prototype'
      profile: EmbeddedDisplayProfile
      bake: EmbeddedPrototypeBakeResult
    }

function deploymentContentLabel(mode: UsbFrameDeploymentPlan['mode']): string {
  if (mode === 'prototype') return '交互内容'
  if (mode === 'slideshow') return '幻灯片'
  return '当前 Frame'
}

export interface PrepareUsbFrameDeploymentInput {
  profile: EmbeddedDisplayProfile
  frame: UsbFrameDeploymentFrame
  file: File
  backgroundColor: string
  placement?: EmbeddedImagePlacement
  firstDeployment: boolean
}

export interface PrepareUsbPrototypeDeploymentInput {
  profile: EmbeddedDisplayProfile
  frame: UsbFrameDeploymentFrame
  bake: EmbeddedPrototypeBakeResult
  backgroundColor: string
  placement?: EmbeddedImagePlacement
  firstDeployment: boolean
}

export interface ExecuteUsbFrameDeploymentOptions {
  isSnapshotCurrent?: () => boolean
  onFirmwareVerified?: (plan: UsbFrameDeploymentPlan) => void | Promise<void>
  onSuccess?: (plan: UsbFrameDeploymentPlan) => void | Promise<void>
}

export interface UpdateUsbFrameDeploymentAdaptationInput {
  placement: EmbeddedImagePlacement
  backgroundColor?: string
}

const plans = reactive(new Map<string, UsbFrameDeploymentRecord>())
let activePlanId: string | null = null

const BUSY_DEPLOYMENT_STATUSES = new Set<UsbFrameDeploymentStatus>([
  'selecting-device',
  'checking-firmware',
  'flashing-firmware',
  'reconnecting',
  'transferring-content'
])
const TERMINAL_DEPLOYMENT_STATUSES = new Set<UsbFrameDeploymentStatus>([
  'success',
  'cancelled',
  'superseded'
])

export function isUsbFrameDeploymentBusy(status: UsbFrameDeploymentStatus): boolean {
  return BUSY_DEPLOYMENT_STATUSES.has(status)
}

function isUsbFrameDeploymentTerminal(status: UsbFrameDeploymentStatus): boolean {
  return TERMINAL_DEPLOYMENT_STATUSES.has(status)
}

export function supersedeUsbFrameDeployment(id: string): void {
  const plan = plans.get(id)
  if (!plan || isUsbFrameDeploymentTerminal(plan.status) || isUsbFrameDeploymentBusy(plan.status)) {
    return
  }
  plan.status = 'superseded'
  plan.error = undefined
  plan.message = '已由新的烧录计划替代'
  releaseDeploymentContent(plan)
}

function supersedeInactiveUsbDeployments(): void {
  for (const plan of plans.values()) supersedeUsbFrameDeployment(plan.id)
}

function appendLog(plan: UsbFrameDeploymentRecord, message: string): void {
  const normalized = message.trim()
  if (!normalized) return
  plan.logs.push(normalized)
  if (plan.logs.length > 80) plan.logs.splice(0, plan.logs.length - 80)
}

function releaseDeploymentContent(plan: UsbFrameDeploymentRecord): void {
  plan.payload = undefined
  plan.source = undefined
  plan.port = undefined
}

function setStageError(plan: UsbFrameDeploymentRecord): void {
  if (plan.firmwareStage === 'running') plan.firmwareStage = 'error'
  if (plan.contentStage === 'running') plan.contentStage = 'error'
}

export function normalizeUsbDeploymentError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'NotFoundError' || name === 'AbortError' || /No port selected/iu.test(message)) {
    return '未选择 USB 设备，系统设备窗口已关闭'
  }
  if (name === 'SecurityError' || name === 'NotAllowedError') {
    return 'USB 串口权限未授予'
  }
  return message
}

async function markFirmwareVerified(
  plan: UsbFrameDeploymentRecord,
  capacity: number,
  stage: 'done' | 'skipped',
  options: ExecuteUsbFrameDeploymentOptions
): Promise<void> {
  plan.firmwareStage = stage
  plan.firmwareVerified = true
  plan.firmwareCapacity = capacity
  try {
    await options.onFirmwareVerified?.(plan)
  } catch (error) {
    appendLog(
      plan,
      `固件状态记忆失败，不影响本次部署：${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function uploadContent(
  plan: UsbFrameDeploymentRecord,
  port: DeploymentSerialPort,
  firmwareUpdated: boolean
): Promise<number> {
  const payload = plan.payload
  if (!payload) throw new Error('烧录内容已释放，请重新准备部署计划')
  plan.status = 'transferring-content'
  plan.contentStage = 'running'
  const progressStart = firmwareUpdated ? 70 : 10
  plan.progress = progressStart
  const contentLabel = deploymentContentLabel(plan.mode)
  plan.message = `正在传输${contentLabel}`
  const flashOptions: UsbFlashOptions = {
    port: port as UsbSerialPort,
    onLog: (message) => appendLog(plan, message),
    onProgress: ({ percent }) => {
      plan.progress = progressStart + Math.round((percent * (100 - progressStart)) / 100)
      plan.message = `正在传输${contentLabel} ${percent}%`
    }
  }
  let capacity: number
  if ('content' in payload) {
    capacity = await flashUsbSequenceFirmware(payload, flashOptions)
  }
  else if (plan.mode === 'prototype' && 'initialStateIndex' in payload) {
    capacity = await flashUsbPrototypeFirmware(payload, flashOptions)
  } else if (!('initialStateIndex' in payload)) {
    capacity = await flashUsbFrameFirmware(payload, flashOptions)
  } else throw new Error('USB 部署内容与计划类型不匹配')
  plan.contentStage = 'done'
  return capacity
}

async function deployContent(
  plan: UsbFrameDeploymentRecord,
  port: DeploymentSerialPort,
  options: ExecuteUsbFrameDeploymentOptions
): Promise<void> {
  plan.firmwareStage = 'running'
  const result = await transferUsbContentWithFirmwareFallback({
    port,
    manifestUrl: plan.manifestUrl,
    transfer: (activePort, firmwareUpdated) =>
      uploadContent(plan, activePort, firmwareUpdated),
    onLog: (message) => appendLog(plan, message),
    onProgress: ({ percent }) => {
      plan.progress = 5 + Math.round(percent * 0.55)
      plan.message = `正在自动更新 USB 基础固件 ${percent}%`
    },
    onStage: (stage, message) => {
      if (stage === 'checking') plan.status = 'checking-firmware'
      else if (stage === 'flashing') {
        plan.status = 'flashing-firmware'
        plan.contentStage = 'pending'
      } else if (stage === 'reconnecting') plan.status = 'reconnecting'
      plan.message = message
      if (stage === 'checking') plan.progress = 3
      if (stage === 'reconnecting') plan.progress = 65
    }
  })
  plan.port = markRaw(result.port)
  await markFirmwareVerified(
    plan,
    result.capacity,
    result.firmwareUpdated ? 'done' : 'skipped',
    options
  )
}

export function getUsbFrameDeploymentPlan(id: string): UsbFrameDeploymentPlan | undefined {
  return plans.get(id)
}

async function buildDeploymentPayload(
  source: UsbFrameDeploymentSource,
  placement: EmbeddedImagePlacement,
  backgroundColor: string
): Promise<{
  payload: EmbeddedImagePayload | EmbeddedPrototypePayload | UsbImageSequencePayload
  contentBytes: number
}> {
  if (source.kind === 'frame') {
    const payload = await imageFileToRgb565(source.file, source.profile, {
      placement,
      backgroundColor
    })
    return { payload, contentBytes: encodeWirelessImage(payload).byteLength }
  }

  const slideshow = source.bake.mode === 'slideshow'
  const payload = slideshow
    ? await imageFilesToUsbSequence(
        source.bake.states.map((state) => state.file),
        source.profile,
        {
          frameDelayMs: source.bake.intervalMs,
          preserveOrder: true,
          placement,
          backgroundColor
        }
      )
    : await prototypeBakeToRgb565(source.bake, source.profile, backgroundColor, placement)
  return {
    payload,
    contentBytes:
      'content' in payload
        ? payload.content.byteLength
        : encodeWirelessPrototype(payload).byteLength
  }
}

export async function updateUsbFrameDeploymentAdaptation(
  id: string,
  input: UpdateUsbFrameDeploymentAdaptationInput
): Promise<boolean> {
  const plan = plans.get(id)
  if (
    !plan ||
    isUsbFrameDeploymentBusy(plan.status) ||
    isUsbFrameDeploymentTerminal(plan.status) ||
    plan.status === 'stale'
  ) {
    return false
  }
  const backgroundColor = input.backgroundColor ?? plan.backgroundColor
  if (plan.placement === input.placement && plan.backgroundColor === backgroundColor) return true

  const source = plan.source
  if (!source) return false
  const result = await buildDeploymentPayload(source, input.placement, backgroundColor)
  if (
    plans.get(id) !== plan ||
    isUsbFrameDeploymentBusy(plan.status) ||
    isUsbFrameDeploymentTerminal(plan.status)
  ) {
    return false
  }
  plan.placement = input.placement
  plan.backgroundColor = backgroundColor
  plan.payload = markRaw(result.payload)
  plan.contentBytes = result.contentBytes
  plan.status = 'ready'
  plan.error = undefined
  plan.progress = 0
  plan.contentStage = 'pending'
  plan.firmwareStage = plan.firmwareVerified ? 'skipped' : 'pending'
  plan.message = '画面适配已更新，等待确认'
  return true
}

export async function prepareUsbFrameDeployment(
  input: PrepareUsbFrameDeploymentInput
): Promise<UsbFrameDeploymentPlan> {
  if (!supportsUsbFrameFastFlash(input.profile.id)) {
    throw new Error('当前屏幕尚未提供 USB 单 Frame 快速部署固件')
  }
  const placement = input.placement ?? 'pixel-perfect'
  const source = markRaw<UsbFrameDeploymentSource>({
    kind: 'frame',
    profile: input.profile,
    file: input.file
  })
  const { payload, contentBytes } = await buildDeploymentPayload(
    source,
    placement,
    input.backgroundColor
  )
  const id = globalThis.crypto.randomUUID()
  supersedeInactiveUsbDeployments()
  const plan = reactive<UsbFrameDeploymentRecord>({
    id,
    mode: 'frame',
    status: 'ready',
    profileId: input.profile.id,
    profileName: input.profile.name,
    resolution: { ...input.profile.resolution },
    roundScreen: input.profile.visibleArea?.shape === 'round',
    frame: { ...input.frame },
    backgroundColor: input.backgroundColor,
    placement,
    previewUrl: URL.createObjectURL(input.file),
    contentBytes,
    firstDeployment: input.firstDeployment,
    needsDeviceSelection: true,
    firmwareVerified: false,
    progress: 0,
    message: '部署内容已准备，等待确认',
    firmwareStage: 'pending',
    contentStage: 'pending',
    logs: [],
    createdAt: Date.now(),
    payload: markRaw(payload),
    source,
    manifestUrl: embeddedManifestUrl(input.profile.id, 'usb-frame')
  })
  plans.set(id, plan)
  return plan
}

export async function prepareUsbPrototypeDeployment(
  input: PrepareUsbPrototypeDeploymentInput
): Promise<UsbFrameDeploymentPlan> {
  if (!supportsUsbFrameFastFlash(input.profile.id)) {
    throw new Error('当前屏幕尚未提供 USB 交互快速部署固件')
  }
  const placement = input.placement ?? 'pixel-perfect'
  const slideshow = input.bake.mode === 'slideshow'
  const source = markRaw<UsbFrameDeploymentSource>({
    kind: 'prototype',
    profile: input.profile,
    bake: input.bake
  })
  const { payload, contentBytes } = await buildDeploymentPayload(
    source,
    placement,
    input.backgroundColor
  )
  const previewFile = input.bake.states.find(
    (state) => state.id === input.bake.initialStateId
  )?.file
  if (!previewFile) throw new Error('交互缺少可预览的初始 Frame')
  const id = globalThis.crypto.randomUUID()
  supersedeInactiveUsbDeployments()
  const plan = reactive<UsbFrameDeploymentRecord>({
    id,
    mode: slideshow ? 'slideshow' : 'prototype',
    status: 'ready',
    profileId: input.profile.id,
    profileName: input.profile.name,
    resolution: { ...input.profile.resolution },
    roundScreen: input.profile.visibleArea?.shape === 'round',
    frame: { ...input.frame },
    prototype: {
      id: input.bake.id,
      name: input.bake.name,
      stateCount: input.bake.states.length,
      transitionCount: input.bake.transitions.length,
      stateNames: input.bake.states.map((state) => state.name)
    },
    backgroundColor: input.backgroundColor,
    placement,
    previewUrl: URL.createObjectURL(previewFile),
    contentBytes,
    firstDeployment: input.firstDeployment,
    needsDeviceSelection: true,
    firmwareVerified: false,
    progress: 0,
    message: slideshow ? '幻灯片内容已准备，等待确认' : '交互内容已准备，等待确认',
    firmwareStage: 'pending',
    contentStage: 'pending',
    logs: [],
    createdAt: Date.now(),
    payload: markRaw(payload),
    source,
    manifestUrl: embeddedManifestUrl(input.profile.id, 'usb-frame')
  })
  plans.set(id, plan)
  return plan
}

export async function executeUsbFrameDeployment(
  id: string,
  options: ExecuteUsbFrameDeploymentOptions = {}
): Promise<boolean> {
  const plan = plans.get(id)
  if (!plan || isUsbFrameDeploymentTerminal(plan.status)) return false
  if (activePlanId && activePlanId !== id) {
    plan.status = 'error'
    plan.error = '另一个 USB 部署任务正在执行'
    plan.message = plan.error
    return false
  }
  if (options.isSnapshotCurrent && !options.isSnapshotCurrent()) {
    plan.status = 'stale'
    plan.error = '设计内容在确认前发生了变化，请重新生成部署计划'
    plan.message = plan.error
    releaseDeploymentContent(plan)
    return false
  }

  activePlanId = id
  plan.error = undefined
  plan.progress = 0
  plan.contentStage = 'pending'
  plan.firmwareStage = plan.firmwareVerified ? 'skipped' : 'pending'
  try {
    plan.status = 'selecting-device'
    plan.message = '正在查找已授权的 USB 设备'
    const authorizedPort = plan.port ?? (await getSingleAuthorizedUsbContentPort())
    plan.message = authorizedPort ? '正在连接已授权的 USB 设备' : '请在系统窗口中选择 USB 设备'
    const port = authorizedPort ?? ((await requestUsbSerialPort()) as DeploymentSerialPort)
    plan.port = markRaw(port)
    plan.needsDeviceSelection = false

    await deployContent(plan, port, options)
    plan.progress = 100
    plan.status = 'success'
    plan.message = `基础固件与${deploymentContentLabel(plan.mode)}已部署完成`
    plan.completedAt = Date.now()
    try {
      await options.onSuccess?.(plan)
    } catch (error) {
      appendLog(
        plan,
        `部署记录保存失败，不影响设备内容：${error instanceof Error ? error.message : String(error)}`
      )
    }
    releaseDeploymentContent(plan)
    return true
  } catch (error) {
    const message = normalizeUsbDeploymentError(error)
    setStageError(plan)
    plan.status = 'error'
    plan.error = message
    plan.message = message
    plan.port = undefined
    plan.needsDeviceSelection = true
    appendLog(plan, message)
    return false
  } finally {
    if (activePlanId === id) activePlanId = null
  }
}

export function cancelUsbFrameDeployment(id: string): void {
  const plan = plans.get(id)
  if (!plan || activePlanId === id || isUsbFrameDeploymentTerminal(plan.status)) {
    return
  }
  plan.status = 'cancelled'
  plan.message = '部署已取消，未执行设备写入'
  releaseDeploymentContent(plan)
}
