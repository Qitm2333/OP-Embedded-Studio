import { markRaw, reactive } from 'vue'

import { embeddedManifestUrl } from '../adapters/http'
import { imageFileToRgb565, prototypeBakeToRgb565 } from '../adapters/image'
import { flashFirmwareManifest } from '../adapters/manifest-firmware'
import {
  flashUsbFrameFirmware,
  flashUsbPrototypeFirmware,
  requestUsbSerialPort,
  supportsUsbFrameFastFlash,
  type UsbFlashOptions,
  type UsbSerialPort
} from '../adapters/usb-content'
import {
  probeUsbContentDevice,
  type UsbContentProbeResult,
  type UsbContentSerialPort
} from '../adapters/usb-content-transfer'
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
  | 'awaiting-firmware-confirmation'
  | 'flashing-firmware'
  | 'reconnecting'
  | 'transferring-content'
  | 'success'
  | 'error'
  | 'cancelled'
  | 'stale'

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
  mode: 'frame' | 'prototype'
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
  previewUrl: string
  contentBytes: number
  firstDeployment: boolean
  needsDeviceSelection: boolean
  firmwareInitializationAuthorized: boolean
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
  payload: EmbeddedImagePayload | EmbeddedPrototypePayload
  port?: DeploymentSerialPort
  manifestUrl: string
}

export interface PrepareUsbFrameDeploymentInput {
  profile: EmbeddedDisplayProfile
  frame: UsbFrameDeploymentFrame
  file: File
  backgroundColor: string
  firstDeployment: boolean
}

export interface PrepareUsbPrototypeDeploymentInput {
  profile: EmbeddedDisplayProfile
  frame: UsbFrameDeploymentFrame
  bake: EmbeddedPrototypeBakeResult
  backgroundColor: string
  firstDeployment: boolean
}

export interface ExecuteUsbFrameDeploymentOptions {
  authorizeFirmwareInitialization?: boolean
  isSnapshotCurrent?: () => boolean
  onFirmwareVerified?: (plan: UsbFrameDeploymentPlan) => void | Promise<void>
  onSuccess?: (plan: UsbFrameDeploymentPlan) => void | Promise<void>
}

interface SerialNavigator {
  getPorts?: () => Promise<DeploymentSerialPort[]>
}

const plans = reactive(new Map<string, UsbFrameDeploymentRecord>())
let activePlanId: string | null = null

function appendLog(plan: UsbFrameDeploymentRecord, message: string): void {
  const normalized = message.trim()
  if (!normalized) return
  plan.logs.push(normalized)
  if (plan.logs.length > 80) plan.logs.splice(0, plan.logs.length - 80)
}

function serialNavigator(): SerialNavigator | null {
  if (typeof navigator === 'undefined') return null
  return (navigator as Navigator & { serial?: SerialNavigator }).serial ?? null
}

async function singleAuthorizedPort(): Promise<DeploymentSerialPort | undefined> {
  const authorized = await serialNavigator()?.getPorts?.()
  return authorized?.length === 1 ? authorized[0] : undefined
}

function setStageError(plan: UsbFrameDeploymentRecord): void {
  if (plan.firmwareStage === 'running') plan.firmwareStage = 'error'
  if (plan.contentStage === 'running') plan.contentStage = 'error'
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

async function waitForFirmware(
  plan: UsbFrameDeploymentRecord,
  port: DeploymentSerialPort
): Promise<{
  probe: Extract<UsbContentProbeResult, { compatible: true }>
  port: DeploymentSerialPort
}> {
  let lastError: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (attempt > 0) await delay(750)
    try {
      const reconnectedPort = (await singleAuthorizedPort()) ?? port
      const result = await probeUsbContentDevice(
        reconnectedPort,
        plan.resolution,
        plan.contentBytes
      )
      if (result.compatible) return { probe: result, port: reconnectedPort }
      lastError = new Error(result.message)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('USB 基础固件写入后未能重新连接设备')
}

async function markFirmwareVerified(
  plan: UsbFrameDeploymentRecord,
  probe: Extract<UsbContentProbeResult, { compatible: true }>,
  stage: 'done' | 'skipped',
  options: ExecuteUsbFrameDeploymentOptions
): Promise<void> {
  plan.firmwareStage = stage
  plan.firmwareVerified = true
  plan.firmwareCapacity = probe.capacity
  try {
    await options.onFirmwareVerified?.(plan)
  } catch (error) {
    appendLog(
      plan,
      `固件状态记忆失败，不影响本次部署：${error instanceof Error ? error.message : String(error)}`
    )
  }
}

async function ensureFirmware(
  plan: UsbFrameDeploymentRecord,
  port: DeploymentSerialPort,
  options: ExecuteUsbFrameDeploymentOptions
): Promise<DeploymentSerialPort | null> {
  plan.status = 'checking-firmware'
  plan.firmwareStage = 'running'
  plan.message = '正在检查 USB 基础固件'
  const probe = await probeUsbContentDevice(port, plan.resolution, plan.contentBytes)
  if (probe.compatible) {
    plan.message = '检测到兼容基础固件，已跳过初始化'
    await markFirmwareVerified(plan, probe, 'skipped', options)
    return port
  }

  if (probe.issue === 'capacity') throw new Error(probe.message)

  const authorized =
    plan.firmwareInitializationAuthorized || options.authorizeFirmwareInitialization === true
  if (!authorized) {
    plan.status = 'awaiting-firmware-confirmation'
    plan.firmwareStage = 'pending'
    plan.message = '设备固件不兼容，需要确认重新初始化后才能继续'
    plan.error = probe.message
    return null
  }

  plan.firmwareInitializationAuthorized = true
  plan.status = 'flashing-firmware'
  plan.firmwareStage = 'running'
  plan.message = '正在写入 USB 基础固件'
  await flashFirmwareManifest(plan.manifestUrl, 'usb-frame', {
    port: port as UsbSerialPort,
    onLog: (message) => appendLog(plan, message),
    onProgress: ({ percent }) => {
      plan.progress = percent
      plan.message = `正在写入 USB 基础固件 ${percent}%`
    }
  })

  plan.status = 'reconnecting'
  plan.progress = 0
  plan.message = '基础固件已写入，正在等待设备重启'
  const verified = await waitForFirmware(plan, port)
  plan.port = markRaw(verified.port)
  await markFirmwareVerified(plan, verified.probe, 'done', options)
  return verified.port
}

async function transferContent(
  plan: UsbFrameDeploymentRecord,
  port: DeploymentSerialPort
): Promise<void> {
  plan.status = 'transferring-content'
  plan.contentStage = 'running'
  plan.progress = 0
  plan.message = plan.mode === 'prototype' ? '正在传输交互状态机' : '正在传输当前 Frame'
  const flashOptions: UsbFlashOptions = {
    port: port as UsbSerialPort,
    onLog: (message) => appendLog(plan, message),
    onProgress: ({ percent }) => {
      plan.progress = percent
      plan.message = `正在传输${plan.mode === 'prototype' ? '交互状态机' : '当前 Frame'} ${percent}%`
    }
  }
  if (plan.mode === 'prototype' && 'initialStateIndex' in plan.payload) {
    await flashUsbPrototypeFirmware(plan.payload, flashOptions)
  } else if (!('initialStateIndex' in plan.payload)) {
    await flashUsbFrameFirmware(plan.payload, flashOptions)
  } else {
    throw new Error('USB 部署内容与计划类型不匹配')
  }
  plan.contentStage = 'done'
}

export function getUsbFrameDeploymentPlan(id: string): UsbFrameDeploymentPlan | undefined {
  return plans.get(id)
}

export async function prepareUsbFrameDeployment(
  input: PrepareUsbFrameDeploymentInput
): Promise<UsbFrameDeploymentPlan> {
  if (!supportsUsbFrameFastFlash(input.profile.id)) {
    throw new Error('当前屏幕尚未提供 USB 单 Frame 快速部署固件')
  }
  if (
    input.frame.width !== input.profile.resolution.width ||
    input.frame.height !== input.profile.resolution.height
  ) {
    throw new Error(
      `Frame 为 ${input.frame.width} × ${input.frame.height}，与目标屏幕 ${input.profile.resolution.width} × ${input.profile.resolution.height} 不一致`
    )
  }

  const payload = await imageFileToRgb565(input.file, input.profile, {
    placement: 'pixel-perfect',
    backgroundColor: input.backgroundColor
  })
  const contentBytes = encodeWirelessImage(payload).byteLength
  const id = globalThis.crypto.randomUUID()
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
    previewUrl: URL.createObjectURL(input.file),
    contentBytes,
    firstDeployment: input.firstDeployment,
    needsDeviceSelection: true,
    firmwareInitializationAuthorized: input.firstDeployment,
    firmwareVerified: false,
    progress: 0,
    message: '部署内容已准备，等待确认',
    firmwareStage: 'pending',
    contentStage: 'pending',
    logs: [],
    createdAt: Date.now(),
    payload: markRaw(payload),
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
  if (
    input.frame.width !== input.profile.resolution.width ||
    input.frame.height !== input.profile.resolution.height
  ) {
    throw new Error(
      `交互 Frame 为 ${input.frame.width} × ${input.frame.height}，与目标屏幕 ${input.profile.resolution.width} × ${input.profile.resolution.height} 不一致`
    )
  }

  const payload = await prototypeBakeToRgb565(input.bake, input.profile, input.backgroundColor)
  const contentBytes = encodeWirelessPrototype(payload).byteLength
  const previewFile = input.bake.states.find(
    (state) => state.id === input.bake.initialStateId
  )?.file
  if (!previewFile) throw new Error('交互缺少可预览的初始 Frame')
  const id = globalThis.crypto.randomUUID()
  const plan = reactive<UsbFrameDeploymentRecord>({
    id,
    mode: 'prototype',
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
    previewUrl: URL.createObjectURL(previewFile),
    contentBytes,
    firstDeployment: input.firstDeployment,
    needsDeviceSelection: true,
    firmwareInitializationAuthorized: input.firstDeployment,
    firmwareVerified: false,
    progress: 0,
    message: '交互内容已准备，等待确认',
    firmwareStage: 'pending',
    contentStage: 'pending',
    logs: [],
    createdAt: Date.now(),
    payload: markRaw(payload),
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
  if (!plan || plan.status === 'cancelled' || plan.status === 'success') return false
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
    return false
  }

  activePlanId = id
  plan.error = undefined
  plan.progress = 0
  try {
    plan.status = 'selecting-device'
    plan.message = '正在查找已授权的 USB 设备'
    const authorizedPort = plan.port ?? (await singleAuthorizedPort())
    plan.message = authorizedPort ? '正在连接已授权的 USB 设备' : '请在系统窗口中选择 USB 设备'
    const port = authorizedPort ?? ((await requestUsbSerialPort()) as DeploymentSerialPort)
    plan.port = markRaw(port)
    plan.needsDeviceSelection = false

    const connectedPort = await ensureFirmware(plan, port, options)
    if (!connectedPort) return false
    await transferContent(plan, connectedPort)
    plan.progress = 100
    plan.status = 'success'
    plan.message =
      plan.mode === 'prototype'
        ? '基础固件与交互状态机已部署完成'
        : '基础固件与当前 Frame 已部署完成'
    plan.completedAt = Date.now()
    try {
      await options.onSuccess?.(plan)
    } catch (error) {
      appendLog(
        plan,
        `部署记录保存失败，不影响设备内容：${error instanceof Error ? error.message : String(error)}`
      )
    }
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStageError(plan)
    plan.status = 'error'
    plan.error = message
    plan.message = message
    appendLog(plan, message)
    return false
  } finally {
    if (activePlanId === id) activePlanId = null
  }
}

export function cancelUsbFrameDeployment(id: string): void {
  const plan = plans.get(id)
  if (!plan || activePlanId === id || plan.status === 'success') return
  plan.status = 'cancelled'
  plan.message = '部署已取消，未执行设备写入'
}
