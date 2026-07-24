<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { PanelHeader, PanelSection } from '@/components/ui/panel'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

import { prepareWifiFirmwareCredentials } from '../adapters/http'
import { flashFirmwareManifest } from '../adapters/manifest-firmware'
import {
  probeWirelessDevice,
  uploadWirelessImage,
  uploadWirelessPrototype,
  uploadWirelessSequence
} from '../adapters/wireless'
import {
  imageFilesToBleSequence,
  imageFilesToWifiSequence,
  type WirelessImageSequencePayload
} from '../adapters/wireless-sequence'
import {
  flashUsbFrameFirmware,
  flashUsbPrototypeFirmware,
  flashUsbSequenceFirmware,
  supportsUsbFrameFastFlash
} from '../adapters/usb-content'
import { useBleDeviceSession } from '../composables/useBleDeviceSession'
import { useEmbeddedDisplay } from '../composables/useEmbeddedDisplay'
import { useSerialDeviceSession } from '../composables/useSerialDeviceSession'
import WifiLiveMirrorPanel from '../live-mirror/components/WifiLiveMirrorPanel.vue'
import type {
  EmbeddedBuildMode,
  EmbeddedBuildStatus,
  EmbeddedFrameBake,
  EmbeddedFrameBakeById,
  EmbeddedFrameBakeState,
  EmbeddedPrototypeBake,
  EmbeddedPrototypeOption
} from '../model/types'

const props = defineProps<{
  bakeState?: EmbeddedFrameBakeState
  bakeFrame?: EmbeddedFrameBake
  bakeFrameById?: EmbeddedFrameBakeById
  bakePrototype?: EmbeddedPrototypeBake
  prototypeOptions?: EmbeddedPrototypeOption[]
}>()

type BurnMode = 'frame' | 'prototype'
type TransportMode = 'usb' | 'wifi' | 'ble' | 'wifi-live'
type FrameResourceSource = 'baked' | 'uploaded' | null
type WirelessTransportMode = 'wifi' | 'ble'
type FirmwareInitializationStatus = 'idle' | 'uploading' | 'success' | 'error'

interface FirmwareInitializationState {
  status: FirmwareInitializationStatus
  progress: number
  message: string
}

const transportMode = ref<TransportMode>('usb')
const burnModeByTransport = ref<Record<TransportMode, BurnMode>>({
  usb: 'frame',
  wifi: 'frame',
  ble: 'frame',
  'wifi-live': 'frame'
})
const burnMode = computed<BurnMode>({
  get: () => burnModeByTransport.value[transportMode.value],
  set: (mode) => {
    burnModeByTransport.value[transportMode.value] = mode
  }
})
const wifiProvisionEnabled = ref(false)
const wifiSsid = ref('')
const wifiPassword = ref('')
const bleSession = useBleDeviceSession()
const serialSession = useSerialDeviceSession()
const wirelessBaseUrl = ref('http://192.168.4.1')
const wirelessStatus = ref<'idle' | 'checking' | 'uploading' | 'success' | 'error'>('idle')
const wirelessMessage = ref('连接设备后，可直接传输当前图片')
const wirelessDeviceReady = ref(false)
const wifiBaseFirmwareReady = ref(false)
const DEFAULT_WIFI_AP_SSID = 'OpenPencil-Setup'
const DEFAULT_WIFI_AP_PASSWORD = 'openpencil'
const deviceDetailsOpen = ref(false)
const bleMaintenanceOpen = ref(false)
const wifiMaintenanceOpen = ref(false)
const liveMirrorBusy = ref(false)
const usbFlashing = ref(false)
const wirelessInitialization = ref<Record<WirelessTransportMode, FirmwareInitializationState>>({
  wifi: { status: 'idle', progress: 0, message: '' },
  ble: { status: 'idle', progress: 0, message: '' }
})
const selectedPrototypeIds = ref<Record<TransportMode, string>>({
  usb: '',
  wifi: '',
  ble: '',
  'wifi-live': ''
})
const selectedPrototypeId = computed({
  get: () => selectedPrototypeIds.value[transportMode.value],
  set: (id: string) => {
    selectedPrototypeIds.value[transportMode.value] = id
  }
})
const wifiSequencePayload = ref<WirelessImageSequencePayload | null>(null)
const bleSequencePayload = ref<WirelessImageSequencePayload | null>(null)
const bakePending = ref(false)
const frameBackgroundColor = ref('#000000')
const bakeError = ref('')
const frameResourceSources = ref<Record<TransportMode, FrameResourceSource>>({
  usb: null,
  wifi: null,
  ble: null,
  'wifi-live': null
})
const frameResourceSource = computed<FrameResourceSource>({
  get: () => frameResourceSources.value[transportMode.value],
  set: (source) => {
    frameResourceSources.value[transportMode.value] = source
  }
})
const prototypePending = ref(false)
const prototypePrepared = ref(false)
const prototypeError = ref('')
const {
  selectedProfile,
  profiles,
  variables,
  selectedImageName,
  imagePayload,
  usbSequencePayload,
  prototypePayload,
  buildStatus,
  buildMessage,
  buildLog,
  manifestUrlFor,
  serviceAvailable,
  selectProfile,
  selectImage,
  selectUsbImageSequence,
  selectPrototype,
  loadCachedFirmware,
  loadProfiles
} = useEmbeddedDisplay()

const resolutionLabel = computed(() => {
  const resolution = selectedProfile.value?.resolution
  return resolution ? `${resolution.width} × ${resolution.height}` : '—'
})
const selectedPrototype = computed(
  () => props.prototypeOptions?.find((option) => option.id === selectedPrototypeId.value) ?? null
)
const selectedPrototypeSelectValue = computed({
  get: () => selectedPrototypeId.value || NO_PROTOTYPE_VALUE,
  set: (value: string) => {
    selectedPrototypeId.value = value === NO_PROTOTYPE_VALUE ? '' : value
  }
})
const modeSwitchLocked = computed(
  () =>
    usbFlashing.value ||
    serialSession.selecting.value ||
    liveMirrorBusy.value ||
    wirelessInitialization.value.wifi.status === 'uploading' ||
    wirelessInitialization.value.ble.status === 'uploading' ||
    bakePending.value ||
    prototypePending.value ||
    ['uploading', 'building'].includes(buildStatus.value) ||
    ['checking', 'uploading'].includes(wirelessStatus.value) ||
    ['checking', 'uploading'].includes(bleSession.status.value)
)
const burnModeOptions = computed(() =>
  [
    { value: 'frame', label: '单 Frame' },
    { value: 'prototype', label: '状态机' }
  ].map((option) => ({
    ...option,
    disabled: modeSwitchLocked.value && option.value !== burnMode.value
  }))
)
const transportOptions = computed(() =>
  [
    { value: 'usb', label: 'USB' },
    { value: 'wifi', label: 'Wi-Fi' },
    { value: 'ble', label: 'BLE' },
    { value: 'wifi-live', label: 'Wi-Fi 实时镜像' }
  ].map((option) => ({
    ...option,
    disabled: modeSwitchLocked.value && option.value !== transportMode.value
  }))
)
const profileOptions = computed(() =>
  profiles.value.map((profile) => ({ value: profile.id, label: profile.name }))
)
const bleBuildMode: EmbeddedBuildMode = 'ble-frame'
const bleManifestUrl = computed(() => manifestUrlFor(bleBuildMode))
const wifiManifestUrl = computed(() => manifestUrlFor('wifi-frame'))
const wifiLiveManifestUrl = computed(() => manifestUrlFor('wifi-live'))
const usbFrameFastSupported = computed(() => supportsUsbFrameFastFlash(selectedProfile.value?.id))
const canBleBakeAndUpload = computed(
  () =>
    transportMode.value === 'ble' &&
    (burnMode.value === 'frame'
      ? canBake.value
      : Boolean(props.bakePrototype && selectedPrototype.value) &&
        prototypeReason.value === '' &&
        !prototypePending.value) &&
    (bleSession.deviceReady.value || bleSession.canReconnect.value) &&
    !['checking', 'uploading'].includes(bleSession.status.value)
)
const wifiTransferAvailable = computed(
  () =>
    transportMode.value === 'wifi' &&
    wirelessDeviceReady.value &&
    !['checking', 'uploading'].includes(wirelessStatus.value)
)
const canWifiBakeAndUpload = computed(
  () =>
    wifiTransferAvailable.value &&
    (burnMode.value === 'frame'
      ? canBake.value
      : Boolean(props.bakePrototype && selectedPrototype.value) &&
        prototypeReason.value === '' &&
        !prototypePending.value)
)
const canWifiFileUpload = computed(
  () => wifiTransferAvailable.value && !bakePending.value && !prototypePending.value
)
const canBleFileUpload = computed(
  () =>
    transportMode.value === 'ble' &&
    burnMode.value === 'frame' &&
    (bleSession.deviceReady.value || bleSession.canReconnect.value) &&
    !['checking', 'uploading'].includes(bleSession.status.value) &&
    !bakePending.value &&
    !prototypePending.value
)
const NO_PROTOTYPE_VALUE = '__embedded-display-no-prototype__'
const prototypeSelectOptions = computed(() => [
  { value: NO_PROTOTYPE_VALUE, label: '请选择交互' },
  ...(props.prototypeOptions ?? []).map((option) => ({
    value: option.id,
    label: `${option.name} · ${option.stateCount} 个状态`
  }))
])
const buildStatusLabels: Record<EmbeddedBuildStatus, string> = {
  loading: '连接中',
  idle: '待构建',
  uploading: '上传资源',
  building: '构建中',
  ready: '可烧录',
  error: '失败'
}
const buildStatusLabel = computed(() => buildStatusLabels[buildStatus.value])
const bakeReason = computed(() => {
  if (!props.bakeState) return '请在画布中选中一个 Frame 或 Frame 内的元素'
  if (!props.bakeState.available) return props.bakeState.reason || '当前选择无法烘焙'
  if (!selectedProfile.value) return '请先选择屏幕方案'
  return props.bakeState.reason || ''
})
const bakeSummary = computed(() => {
  if (bakeReason.value) return bakeReason.value
  const state = props.bakeState
  const profile = selectedProfile.value
  if (!state || !profile) return ''
  const dimensions = `${state.width} × ${state.height}`
  return state.width === profile.resolution.width && state.height === profile.resolution.height
    ? dimensions
    : `${dimensions} · 1:1 居中裁切 · 背景延展`
})
const prototypeReason = computed(() => {
  if (!selectedPrototype.value) return '请先选择一个命名交互'
  if (!selectedPrototype.value.valid) return selectedPrototype.value.reason || '交互定义不完整'
  if (!selectedProfile.value) return '请先选择屏幕方案'
  return ''
})
const canBake = computed(
  () =>
    Boolean(props.bakeFrame && props.bakeState?.available) &&
    bakeReason.value === '' &&
    !bakePending.value &&
    !['uploading', 'building'].includes(buildStatus.value)
)
const canPreparePrototype = computed(
  () =>
    (transportMode.value === 'usb' ||
      transportMode.value === 'wifi' ||
      transportMode.value === 'ble') &&
    Boolean(props.bakePrototype && selectedPrototype.value) &&
    prototypeReason.value === '' &&
    !prototypePending.value &&
    !['uploading', 'building'].includes(buildStatus.value)
)
const canUsbFrameFlash = computed(
  () =>
    transportMode.value === 'usb' &&
    burnMode.value === 'frame' &&
    usbFrameFastSupported.value &&
    canBake.value &&
    !usbFlashing.value
)
const canUsbFileFlash = computed(
  () =>
    transportMode.value === 'usb' &&
    burnMode.value === 'frame' &&
    usbFrameFastSupported.value &&
    !usbFlashing.value &&
    !bakePending.value
)
const canUsbPrototypeFlash = computed(
  () =>
    transportMode.value === 'usb' &&
    burnMode.value === 'prototype' &&
    usbFrameFastSupported.value &&
    Boolean(props.bakePrototype && selectedPrototype.value) &&
    prototypeReason.value === '' &&
    !prototypePending.value &&
    !usbFlashing.value
)
const wifiCredentials = computed(() =>
  wifiProvisionEnabled.value && wifiSsid.value.trim()
    ? { ssid: wifiSsid.value.trim(), password: wifiPassword.value }
    : undefined
)

watch(
  [transportMode, () => props.prototypeOptions],
  ([, options]) => {
    if (!options?.some((option) => option.id === selectedPrototypeId.value)) {
      selectedPrototypeId.value = options?.[0]?.id ?? ''
    }
    prototypePrepared.value = false
  },
  { immediate: true, deep: true }
)

watch(selectedPrototypeId, () => {
  prototypePrepared.value = false
  prototypeError.value = ''
})

watch(
  () => selectedProfile.value?.id,
  () => {
    prototypePrepared.value = false
    prototypeError.value = ''
  }
)

async function handleBakeFrame(): Promise<boolean> {
  if (!props.bakeFrame || !canBake.value) return false
  bakePending.value = true
  bakeError.value = ''
  try {
    const file = await props.bakeFrame()
    if (!file) return false
    await selectImage(file, {
      upload: false,
      placement: 'pixel-perfect',
      backgroundColor: frameBackgroundColor.value
    })
    frameResourceSource.value = 'baked'
    return true
  } catch (error) {
    bakeError.value = error instanceof Error ? error.message : String(error)
    return false
  } finally {
    bakePending.value = false
  }
}

async function handleUsbFrameBakeAndFlash(source: 'frame' | 'file' = 'frame') {
  const requestedProfileId = selectedProfile.value?.id
  if (!requestedProfileId || usbFlashing.value) return

  let port
  try {
    port = await serialSession.requirePort()
  } catch (error) {
    bakeError.value = error instanceof Error ? error.message : String(error)
    return
  }
  if (source === 'frame') {
    if (!canUsbFrameFlash.value || !(await handleBakeFrame())) return
  } else if (!canUsbFileFlash.value) {
    return
  }

  const sequence = source === 'file' ? usbSequencePayload.value : null
  const image = imagePayload.value
  const contentProfileId = sequence?.profileId ?? image?.profileId
  if ((!sequence && !image) || !contentProfileId) {
    bakeError.value = '请先烘焙、选择图片或选择 PNG 序列'
    return
  }
  if (
    transportMode.value !== 'usb' ||
    burnMode.value !== 'frame' ||
    selectedProfile.value?.id !== requestedProfileId ||
    contentProfileId !== requestedProfileId
  ) {
    return
  }

  usbFlashing.value = true
  buildStatus.value = 'uploading'
  buildMessage.value = sequence
    ? `正在准备 USB PNG 序列：${sequence.frameCount} 帧…`
    : '正在准备完整 USB 单 Frame 固件…'
  buildLog.value = []
  const flashOptions = {
    port,
    onLog: (message: string) => {
      const normalized = message.trim()
      if (normalized) buildLog.value.push(normalized)
    },
    onProgress: ({
      percent,
      written,
      total
    }: {
      percent: number
      written: number
      total: number
    }) => {
      buildMessage.value = `正在烧录完整固件：${percent}%（${written} / ${total} 字节）`
    }
  }
  try {
    if (sequence) await flashUsbSequenceFirmware(sequence, flashOptions)
    else if (image) await flashUsbFrameFirmware(image, flashOptions)
    buildStatus.value = 'ready'
    buildMessage.value = sequence
      ? `PNG 序列已写入：${sequence.frameCount} 帧 · 20 FPS，设备正在重启。`
      : '完整固件和最新 Frame 已写入，设备正在重启。'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    buildStatus.value = 'error'
    buildMessage.value = `USB Frame 烧录失败：${message}`
    buildLog.value.push(message)
  } finally {
    usbFlashing.value = false
  }
}

async function handleUsbPrototypeBakeAndFlash() {
  if (!canUsbPrototypeFlash.value) return
  const requestedProfileId = selectedProfile.value?.id
  if (!requestedProfileId) return

  let port
  try {
    port = await serialSession.requirePort()
  } catch (error) {
    prototypeError.value = error instanceof Error ? error.message : String(error)
    return
  }
  if (!(await preparePrototypeResources(false)) || !prototypePayload.value) return
  if (
    transportMode.value !== 'usb' ||
    burnMode.value !== 'prototype' ||
    selectedProfile.value?.id !== requestedProfileId ||
    prototypePayload.value.profileId !== requestedProfileId
  ) {
    return
  }

  usbFlashing.value = true
  buildStatus.value = 'uploading'
  buildMessage.value = '正在准备 USB 状态机内容…'
  buildLog.value = []
  try {
    await flashUsbPrototypeFirmware(prototypePayload.value, {
      port,
      onLog: (message) => {
        const normalized = message.trim()
        if (normalized) buildLog.value.push(normalized)
      },
      onProgress: ({ percent, written, total }) => {
        buildMessage.value = `正在烧录状态机：${percent}%（${written} / ${total} 字节）`
      }
    })
    buildStatus.value = 'ready'
    buildMessage.value = '状态机和全部界面已写入，设备正在重启。'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    buildStatus.value = 'error'
    buildMessage.value = `USB 状态机烧录失败：${message}`
    buildLog.value.push(message)
  } finally {
    usbFlashing.value = false
  }
}

async function handleBleBakeAndUpload() {
  if (!canBleBakeAndUpload.value) return
  bleSequencePayload.value = null
  const requestedMode = burnMode.value
  const requestedProfileId = selectedProfile.value?.id
  if (!requestedProfileId) return

  if (requestedMode === 'prototype') {
    if (!(await preparePrototypeResources(false)) || !prototypePayload.value) return
    if (
      transportMode.value !== 'ble' ||
      burnMode.value !== requestedMode ||
      selectedProfile.value?.id !== requestedProfileId
    ) {
      return
    }
    await bleSession.upload(prototypePayload.value)
    return
  }

  if (!(await handleBakeFrame()) || !imagePayload.value) return
  if (
    transportMode.value !== 'ble' ||
    burnMode.value !== requestedMode ||
    selectedProfile.value?.id !== requestedProfileId
  ) {
    return
  }
  await bleSession.upload(imagePayload.value)
}

async function handleWifiBakeAndUpload() {
  if (!canWifiBakeAndUpload.value) return
  wifiSequencePayload.value = null
  const requestedMode = burnMode.value
  const requestedProfileId = selectedProfile.value?.id
  if (!requestedProfileId) return

  if (requestedMode === 'prototype') {
    if (!(await preparePrototypeResources(false)) || !prototypePayload.value) return
  } else if (!(await handleBakeFrame()) || !imagePayload.value) {
    return
  }

  await uploadWifiContent(requestedMode, requestedProfileId)
}

async function handleUsbImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  const requestedProfileId = selectedProfile.value?.id
  if (!files.length || !requestedProfileId || !canUsbFileFlash.value) return

  frameResourceSource.value = 'uploaded'
  bakeError.value = ''
  try {
    // File selection only prepares content. A separate button click requests Web Serial permission.
    // Clear both USB content variants first so failed conversion can never flash stale data.
    await selectImage(undefined, { upload: false })
    if (files.length === 1) await selectImage(files[0], { upload: false })
    else await selectUsbImageSequence(files)

    const content = files.length === 1 ? imagePayload.value : usbSequencePayload.value
    if (
      !content ||
      content.frameCount !== files.length ||
      buildStatus.value === 'error' ||
      transportMode.value !== 'usb' ||
      burnMode.value !== 'frame' ||
      selectedProfile.value?.id !== requestedProfileId ||
      content.profileId !== requestedProfileId
    ) {
      return
    }
    buildMessage.value =
      files.length === 1
        ? '图片已准备，请点击“连接串口并烧录”'
        : 'PNG 序列已准备，请点击“连接串口并烧录”'
  } catch (error) {
    bakeError.value = error instanceof Error ? error.message : String(error)
  } finally {
    input.value = ''
  }
}

async function handleWifiImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  const profile = selectedProfile.value
  if (!files.length || !profile || !canWifiFileUpload.value) return

  frameResourceSource.value = 'uploaded'
  wifiSequencePayload.value = null
  try {
    await selectImage(undefined, { upload: false })
    if (files.length === 1) {
      await selectImage(files[0], { upload: false })
      if (
        !imagePayload.value ||
        imagePayload.value.name !== files[0].name ||
        buildStatus.value === 'error'
      ) {
        return
      }
      await uploadWifiContent('frame', profile.id)
      return
    }

    const sequence = await imageFilesToWifiSequence(files, profile)
    if (
      transportMode.value !== 'wifi' ||
      burnMode.value !== 'frame' ||
      selectedProfile.value?.id !== profile.id
    )
      return
    wifiSequencePayload.value = sequence
    wirelessStatus.value = 'uploading'
    wirelessMessage.value = `正在通过 Wi-Fi 传输 PNG 序列：${sequence.frameCount} 帧…`
    await uploadWirelessSequence(wirelessBaseUrl.value, sequence)
    wirelessStatus.value = 'success'
    wirelessMessage.value = `PNG 序列已传输：${sequence.frameCount} 帧 · 20 FPS，设备正在重启`
  } catch (error) {
    wirelessStatus.value = 'error'
    wirelessMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    input.value = ''
  }
}

async function handleBleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  const profile = selectedProfile.value
  if (!files.length || !profile || !canBleFileUpload.value) return

  frameResourceSource.value = 'uploaded'
  bleSequencePayload.value = null
  try {
    await selectImage(undefined, { upload: false })
    if (files.length === 1) {
      await selectImage(files[0], { upload: false })
      if (
        !imagePayload.value ||
        imagePayload.value.name !== files[0].name ||
        buildStatus.value === 'error' ||
        transportMode.value !== 'ble' ||
        burnMode.value !== 'frame' ||
        selectedProfile.value?.id !== profile.id ||
        imagePayload.value.profileId !== profile.id
      )
        return
      await bleSession.upload(imagePayload.value)
      return
    }

    const sequence = await imageFilesToBleSequence(files, profile)
    if (
      transportMode.value !== 'ble' ||
      burnMode.value !== 'frame' ||
      selectedProfile.value?.id !== profile.id
    )
      return
    bleSequencePayload.value = sequence
    await bleSession.upload(sequence)
  } catch (error) {
    bakeError.value = error instanceof Error ? error.message : String(error)
  } finally {
    input.value = ''
  }
}

async function preparePrototypeResources(uploadToBuildService = false) {
  if (!props.bakePrototype || !selectedPrototype.value || prototypeReason.value) return false
  prototypePending.value = true
  prototypePrepared.value = false
  prototypeError.value = ''
  try {
    const bake = await props.bakePrototype(selectedPrototypeId.value)
    if (!bake) throw new Error('无法读取所选交互')
    await selectPrototype(bake, {
      upload: uploadToBuildService,
      backgroundColor: frameBackgroundColor.value
    })
    prototypePrepared.value = true
    return true
  } catch (error) {
    prototypeError.value = error instanceof Error ? error.message : String(error)
    return false
  } finally {
    prototypePending.value = false
  }
}

async function handlePreparePrototype() {
  if (!canPreparePrototype.value) return
  await preparePrototypeResources()
}

function resetWirelessInitialization(mode: WirelessTransportMode) {
  wirelessInitialization.value[mode] = {
    status: 'idle',
    progress: 0,
    message: ''
  }
}

async function handleInitializeWirelessFirmware(mode: WirelessTransportMode) {
  if (transportMode.value !== mode) return
  const manifestUrl = mode === 'wifi' ? wifiManifestUrl.value : bleManifestUrl.value
  const profileId = selectedProfile.value?.id
  if (!manifestUrl || !profileId) return

  const state = wirelessInitialization.value[mode]
  let port
  try {
    port = await serialSession.requirePort()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    state.status = 'error'
    state.message = message
    buildStatus.value = 'error'
    buildMessage.value = message
    return
  }

  state.status = 'uploading'
  state.progress = 0
  state.message = `正在准备 ${mode === 'wifi' ? 'Wi-Fi' : 'BLE'} 基础固件…`
  buildStatus.value = 'uploading'
  buildMessage.value = state.message
  buildLog.value = []

  try {
    if (mode === 'wifi') {
      state.message = '正在准备 Wi-Fi 配置…'
      buildMessage.value = state.message
      await prepareWifiFirmwareCredentials(profileId, wifiCredentials.value)
    }
    await flashFirmwareManifest(manifestUrl, mode === 'wifi' ? 'wifi-frame' : 'ble-frame', {
      port,
      preparingMessage: state.message,
      connectedMessage: `已连接，正在初始化 ${mode === 'wifi' ? 'Wi-Fi' : 'BLE'} 设备。`,
      onLog: (message) => {
        const normalized = message.trim()
        if (!normalized) return
        state.message = normalized
        buildMessage.value = normalized
        buildLog.value.push(normalized)
      },
      onProgress: ({ percent, written, total }) => {
        state.progress = percent
        state.message = `正在写入基础固件：${percent}%（${written} / ${total} 字节）`
        buildMessage.value = state.message
      }
    })
    state.status = 'success'
    state.progress = 100
    state.message = `${mode === 'wifi' ? 'Wi-Fi' : 'BLE'} 设备初始化完成，设备正在重启。`
    buildStatus.value = 'ready'
    buildMessage.value = state.message
    if (mode === 'wifi') {
      wifiBaseFirmwareReady.value = true
      wirelessDeviceReady.value = false
      wirelessStatus.value = 'idle'
      wirelessMessage.value = '初始化完成；连接设备热点后检查连接'
    } else {
      bleSession.markFirmwareBuilt('BLE 初始化完成；设备重启后可直接连接')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    state.status = 'error'
    state.message = `初始化失败：${message}`
    buildStatus.value = 'error'
    buildMessage.value = state.message
    buildLog.value.push(message)
  }
}

async function handleProbeBle() {
  const profile = selectedProfile.value
  if (!profile || transportMode.value !== 'ble') return
  await bleSession.probe(profile, burnMode.value)
}

async function handleProbeWifi() {
  const requestedProfile = selectedProfile.value
  const requestedBaseUrl = wirelessBaseUrl.value
  if (!requestedProfile || transportMode.value !== 'wifi') return

  wirelessStatus.value = 'checking'
  wirelessMessage.value = '正在检查设备连接…'
  buildLog.value = [`wifi-device: ${requestedBaseUrl}`, 'probe: checking']
  try {
    const device = await probeWirelessDevice(requestedBaseUrl)
    if (transportMode.value !== 'wifi' || selectedProfile.value?.id !== requestedProfile.id) {
      return
    }
    if (
      device.width !== requestedProfile.resolution.width ||
      device.height !== requestedProfile.resolution.height
    ) {
      throw new Error(
        `设备分辨率为 ${device.width} × ${device.height}，与当前方案 ${requestedProfile.resolution.width} × ${requestedProfile.resolution.height} 不匹配`
      )
    }
    wirelessDeviceReady.value = true
    wifiBaseFirmwareReady.value = true
    wirelessStatus.value = 'success'
    wirelessMessage.value = `设备已连接：${device.width} × ${device.height}${device.ip ? `，Wi-Fi 地址 ${device.ip}` : ''}`
    buildLog.value = [
      `wifi-device: ${requestedBaseUrl}`,
      `size: ${device.width}×${device.height}`,
      'probe: ok'
    ]
  } catch (error) {
    if (transportMode.value !== 'wifi' || selectedProfile.value?.id !== requestedProfile.id) {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    wirelessStatus.value = 'error'
    wirelessMessage.value = message
    buildLog.value = [`wifi-device: ${requestedBaseUrl}`, `probe-error: ${message}`]
  }
}

async function uploadWifiContent(requestedMode: 'frame' | 'prototype', requestedProfileId: string) {
  if (
    transportMode.value !== 'wifi' ||
    burnMode.value !== requestedMode ||
    selectedProfile.value?.id !== requestedProfileId ||
    !wifiTransferAvailable.value
  ) {
    return
  }

  const requestedBaseUrl = wirelessBaseUrl.value
  const image = requestedMode === 'frame' ? imagePayload.value : null
  const prototype = requestedMode === 'prototype' ? prototypePayload.value : null
  if (requestedMode === 'frame' ? !image : !prototype) return

  wirelessStatus.value = 'uploading'
  wirelessMessage.value =
    requestedMode === 'prototype' ? '正在通过 Wi-Fi 传输状态机…' : '正在通过 Wi-Fi 传输图片…'
  buildLog.value = [
    `wifi-device: ${requestedBaseUrl}`,
    `content: ${requestedMode}`,
    'upload: sending'
  ]
  try {
    if (requestedMode === 'prototype' && prototype) {
      await uploadWirelessPrototype(requestedBaseUrl, prototype)
    } else if (requestedMode === 'frame' && image) {
      await uploadWirelessImage(requestedBaseUrl, image)
    }
    wirelessStatus.value = 'success'
    wirelessMessage.value =
      requestedMode === 'prototype'
        ? '状态机已传输，设备将重启并加载交互内容'
        : '图片已传输，设备将重启并加载新内容'
    buildLog.value.push('upload: ok')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    wirelessStatus.value = 'error'
    wirelessMessage.value = message
    buildLog.value.push(`upload-error: ${message}`)
  }
}

function buildMessageForTransport(mode: TransportMode): string {
  if (mode === 'usb') return '选择内容后可直接烧录。'
  if (mode === 'wifi') return '连接 Wi-Fi 设备后可传输内容。'
  if (mode === 'wifi-live') return '连接 Wi-Fi 设备后可开始实时镜像。'
  return bleSession.message.value
}

let firmwareLoadSequence = 0
watch(
  [transportMode, () => selectedProfile.value?.id],
  async ([mode, profileId]) => {
    const sequence = ++firmwareLoadSequence
    wirelessDeviceReady.value = false
    wifiBaseFirmwareReady.value = false
    bakeError.value = ''
    frameResourceSource.value = null
    prototypeError.value = ''
    prototypePrepared.value = false
    buildLog.value = []
    if (buildStatus.value !== 'loading') buildStatus.value = 'idle'
    buildMessage.value = buildMessageForTransport(mode)
    if (mode === 'wifi') {
      resetWirelessInitialization('wifi')
      wirelessStatus.value = 'idle'
      wirelessMessage.value = '连接设备热点后检查连接，再传输当前模式的内容'
    }
    if (mode === 'ble') {
      resetWirelessInitialization('ble')
      bleSession.setProfile(selectedProfile.value)
    }
    if (!profileId) return

    if (mode === 'ble') {
      const available = await loadCachedFirmware(bleBuildMode)
      if (
        sequence !== firmwareLoadSequence ||
        transportMode.value !== 'ble' ||
        selectedProfile.value?.id !== profileId
      )
        return
      bleSession.setBaseFirmwareReady(available)
      return
    }

    if (mode === 'wifi' || mode === 'wifi-live') {
      const available = await loadCachedFirmware(mode === 'wifi-live' ? 'wifi-live' : 'wifi-frame')
      if (sequence !== firmwareLoadSequence || transportMode.value !== mode) return
      wifiBaseFirmwareReady.value = available
    }
  },
  { immediate: true }
)

watch([wifiSsid, wifiPassword], () => {
  wifiBaseFirmwareReady.value = false
  if (wirelessInitialization.value.wifi.status !== 'uploading') {
    resetWirelessInitialization('wifi')
  }
})
</script>
<template>
  <div class="flex min-h-0 flex-1 flex-col bg-panel text-surface">
    <PanelHeader>
      <template #icon>
        <icon-lucide-cpu class="size-panel-icon" />
      </template>
      <span role="heading" aria-level="2">设备烧录</span>
      <template #actions>
        <span
          class="flex items-center gap-1 text-[10px]"
          :class="serviceAvailable ? 'text-success' : 'text-muted'"
        >
          <span class="size-1.5 rounded-full bg-current" />
          {{ serviceAvailable ? '服务正常' : '服务离线' }}
        </span>
      </template>
    </PanelHeader>

    <div class="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4">
      <PanelSection label="设备选型">
        <template #actions>
          <IconButton
            :label="deviceDetailsOpen ? '收起设备详情' : '查看设备详情'"
            :active="deviceDetailsOpen"
            :disabled="!selectedProfile"
            @click="deviceDetailsOpen = !deviceDetailsOpen"
          >
            <icon-lucide-info class="size-3.5" />
          </IconButton>
          <IconButton label="重新连接设备服务" @click="loadProfiles">
            <icon-lucide-refresh-cw class="size-3.5" />
          </IconButton>
        </template>

        <AppSelect
          v-if="profiles.length"
          :model-value="selectedProfile?.id || ''"
          :options="profileOptions"
          :disabled="modeSwitchLocked"
          label="设备型号"
          @update:model-value="selectProfile"
        />
        <p v-else class="text-[11px] text-muted">{{ buildMessage }}</p>

        <div
          v-if="selectedProfile"
          class="mt-panel rounded-panel border border-border bg-panel-field p-2"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="size-2 shrink-0 rounded-full"
                :class="serialSession.ready.value ? 'bg-success' : 'bg-muted'"
              />
              <div class="min-w-0">
                <p class="truncate text-xs font-medium text-surface">
                  {{ serialSession.label.value }}
                </p>
                <p class="mt-0.5 truncate text-[10px] text-muted">
                  {{ serialSession.message.value }}
                </p>
              </div>
            </div>
            <span
              class="shrink-0 text-[10px]"
              :class="serialSession.ready.value ? 'text-success' : 'text-muted'"
            >
              {{ serialSession.ready.value ? '已选择' : '未选择' }}
            </span>
          </div>
          <button
            type="button"
            class="mt-2 h-control w-full rounded-panel border border-border bg-canvas px-3 text-xs font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="modeSwitchLocked || serialSession.selecting.value || !serialSession.supported.value"
            @click="serialSession.selectPort"
          >
            {{
              serialSession.selecting.value
                ? '等待选择串口…'
                : serialSession.ready.value
                  ? '重新选择串口'
                  : '选择串口设备'
            }}
          </button>
          <p class="mt-1 text-[10px] leading-relaxed text-muted">
            仅在烧录时打开串口，完成后自动释放；刷新页面后会恢复已授权设备。
          </p>
        </div>

        <div
          v-if="selectedProfile && deviceDetailsOpen"
          class="mt-panel grid grid-cols-[68px_minmax(0,1fr)] gap-y-1 border-t border-border pt-panel text-[11px]"
        >
          <span class="text-muted">分辨率</span><span>{{ resolutionLabel }}</span>
          <span class="text-muted">控制器</span><span>{{ selectedProfile.controller }}</span>
          <span class="text-muted">接口</span><span>{{ selectedProfile.interface }}</span>
          <span class="text-muted">驱动</span><span>{{ selectedProfile.driverIc || '—' }}</span>
          <span class="text-muted">验证</span
          ><span>{{ selectedProfile.verified ? '已验证' : '待验证' }}</span>
        </div>
      </PanelSection>

      <PanelSection label="传输方式">
        <SegmentedControl
          v-model="transportMode"
          class="w-full"
          :options="transportOptions"
          label="选择传输方式"
        />
      </PanelSection>

      <PanelSection v-if="burnMode === 'frame'" label="Frame 补边背景">
        <div
          class="flex items-center justify-between gap-3 rounded-panel border border-border bg-panel-field p-2"
        >
          <div class="min-w-0 flex-1">
            <p class="text-xs font-medium text-surface">背景颜色</p>
            <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
              尺寸不匹配时用于 1:1 居中补边，默认黑色
            </p>
          </div>
          <input
            v-model="frameBackgroundColor"
            type="color"
            aria-label="Frame 补边背景颜色"
            class="h-8 w-10 shrink-0 cursor-pointer rounded border border-border bg-canvas p-0.5"
          />
        </div>
      </PanelSection>

      <WifiLiveMirrorPanel
        v-if="transportMode === 'wifi-live'"
        :profile="selectedProfile"
        :manifest-url="wifiLiveManifestUrl"
        :bake-state="bakeState"
        :bake-frame-by-id="bakeFrameById"
        :background-color="frameBackgroundColor"
        @busy-change="liveMirrorBusy = $event"
      />

      <PanelSection
        v-if="transportMode === 'ble'"
        label="首次使用 / 设备维护"
        :open="bleMaintenanceOpen"
        @update:open="bleMaintenanceOpen = $event"
      >
        <p class="text-[10px] leading-relaxed text-muted">
          基础固件已随 OpenPencil 提供。只有首次使用、设备维护或固件升级时才需要重新初始化。
        </p>
        <button
          type="button"
          class="mt-1.5 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!bleManifestUrl || wirelessInitialization.ble.status === 'uploading'"
          @click="handleInitializeWirelessFirmware('ble')"
        >
          {{
            wirelessInitialization.ble.status === 'uploading'
              ? `正在初始化：${wirelessInitialization.ble.progress}%`
              : '通过 USB 初始化 BLE 设备'
          }}
        </button>
        <div
          v-if="wirelessInitialization.ble.status !== 'idle'"
          class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-field"
        >
          <div
            class="h-full transition-[width]"
            :class="wirelessInitialization.ble.status === 'error' ? 'bg-error' : 'bg-accent'"
            :style="{ width: wirelessInitialization.ble.progress + '%' }"
          />
        </div>
        <p
          class="mt-1 text-[10px] leading-relaxed"
          :class="wirelessInitialization.ble.status === 'error' ? 'text-error' : 'text-muted'"
        >
          {{
            wirelessInitialization.ble.message ||
            (bleManifestUrl
              ? 'BLE 基础固件已完备；连接 USB 后可直接初始化。'
              : '预置 BLE 固件缺失，请检查后端固件资源。')
          }}
        </p>
      </PanelSection>

      <PanelSection v-if="transportMode === 'ble'" label="BLE 设备">
        <div
          class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-2 text-[11px]"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="bleSession.deviceReady.value ? 'bg-success' : 'bg-muted'"
            />
            <div class="min-w-0">
              <p class="truncate text-surface">
                {{ bleSession.deviceReady.value ? bleSession.deviceName.value : '尚未连接设备' }}
              </p>
              <p class="truncate text-[10px] text-muted">
                {{
                  bleSession.deviceReady.value
                    ? bleSession.firmwareMode.value === 'unified'
                      ? 'BLE 通用固件已连接'
                      : bleSession.firmwareMode.value === 'prototype'
                        ? 'BLE 状态机旧版固件已连接'
                        : bleSession.firmwareMode.value === 'frame'
                          ? 'BLE 单 Frame 旧版固件已连接'
                          : 'BLE 已连接，固件模式未知'
                    : '连接后将检查设备固件模式'
                }}
              </p>
            </div>
          </div>
          <span :class="bleSession.deviceReady.value ? 'text-success' : 'text-muted'">{{
            bleSession.deviceReady.value ? '已连接' : '未连接'
          }}</span>
        </div>
        <button
          type="button"
          class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="
            bleSession.status.value === 'checking' || bleSession.status.value === 'uploading'
          "
          @click="handleProbeBle"
        >
          {{
            bleSession.status.value === 'checking'
              ? '等待选择 BLE 设备…'
              : bleSession.deviceReady.value
                ? '重新选择 BLE 设备'
                : '连接 BLE 设备'
          }}
        </button>
        <p
          class="mt-1 text-[10px] leading-relaxed"
          :class="bleSession.status.value === 'error' ? 'text-error' : 'text-muted'"
        >
          {{ bleSession.message.value }}
        </p>
        <div
          v-if="bleSession.status.value === 'uploading'"
          class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-field"
        >
          <div
            class="h-full bg-accent transition-[width]"
            :style="{ width: bleSession.progress.value + '%' }"
          />
        </div>
      </PanelSection>

      <PanelSection
        v-if="transportMode === 'wifi'"
        label="首次使用 / 设备维护"
        :open="wifiMaintenanceOpen"
        @update:open="wifiMaintenanceOpen = $event"
      >
        <p class="text-[10px] leading-relaxed text-muted">
          基础固件已随 OpenPencil 提供。只有首次使用、修改网络配置或设备维护时才需要重新初始化。
        </p>
        <label class="mt-panel flex items-center gap-2 text-[11px] text-surface">
          <input
            v-model="wifiProvisionEnabled"
            type="checkbox"
            class="accent-accent"
            :disabled="modeSwitchLocked"
          />
          <span>同时写入局域网 Wi-Fi（可选）</span>
        </label>
        <div v-if="wifiProvisionEnabled" class="mt-1.5 grid gap-1.5">
          <input
            v-model="wifiSsid"
            class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
            :disabled="modeSwitchLocked"
            type="text"
            maxlength="32"
            placeholder="局域网 Wi-Fi 名称（SSID）"
            aria-label="局域网 Wi-Fi 名称"
          />
          <input
            v-model="wifiPassword"
            class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
            :disabled="modeSwitchLocked"
            type="password"
            maxlength="64"
            placeholder="局域网 Wi-Fi 密码（可为空）"
            aria-label="局域网 Wi-Fi 密码"
          />
        </div>
        <button
          type="button"
          class="mt-1.5 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!wifiManifestUrl || wirelessInitialization.wifi.status === 'uploading'"
          @click="handleInitializeWirelessFirmware('wifi')"
        >
          {{
            wirelessInitialization.wifi.status === 'uploading'
              ? `正在初始化：${wirelessInitialization.wifi.progress}%`
              : '通过 USB 初始化 Wi-Fi 设备'
          }}
        </button>
        <div
          v-if="wirelessInitialization.wifi.status !== 'idle'"
          class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-field"
        >
          <div
            class="h-full transition-[width]"
            :class="wirelessInitialization.wifi.status === 'error' ? 'bg-error' : 'bg-accent'"
            :style="{ width: wirelessInitialization.wifi.progress + '%' }"
          />
        </div>
        <p
          class="mt-1 text-[10px] leading-relaxed"
          :class="wirelessInitialization.wifi.status === 'error' ? 'text-error' : 'text-muted'"
        >
          {{
            wirelessInitialization.wifi.message ||
            (wifiManifestUrl
              ? 'Wi-Fi 基础固件已完备；连接 USB 后可直接初始化。'
              : '预置 Wi-Fi 固件缺失，请检查后端固件资源。')
          }}
        </p>
      </PanelSection>

      <PanelSection v-if="transportMode === 'wifi'" label="Wi-Fi 设备">
        <div
          class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-2 text-[11px]"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span
              class="size-2 shrink-0 rounded-full"
              :class="wirelessDeviceReady ? 'bg-success' : 'bg-muted'"
            />
            <div class="min-w-0">
              <p class="text-surface">
                {{ wirelessDeviceReady ? '设备已连接' : '尚未连接设备' }}
              </p>
              <p class="text-[10px] text-muted">
                {{ wirelessDeviceReady ? 'Wi-Fi 已连接，可以传输内容' : '连接设备热点后检查连接' }}
              </p>
            </div>
          </div>
          <span :class="wirelessDeviceReady ? 'text-success' : 'text-muted'">{{
            wirelessDeviceReady ? '已连接' : '未连接'
          }}</span>
        </div>
        <div
          class="mt-panel rounded-panel border border-border bg-panel-field px-2 py-2 text-[11px]"
        >
          <p class="text-surface">设备热点</p>
          <p class="mt-1 text-muted">名称：{{ DEFAULT_WIFI_AP_SSID }}</p>
          <p class="text-muted">密码：{{ DEFAULT_WIFI_AP_PASSWORD }}</p>
        </div>
        <input
          v-model="wirelessBaseUrl"
          class="mt-panel h-control w-full rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
          :disabled="modeSwitchLocked"
          type="url"
          placeholder="http://192.168.4.1"
          aria-label="设备地址"
        />
        <button
          type="button"
          class="mt-1.5 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:opacity-50"
          :disabled="wirelessStatus === 'checking'"
          @click="handleProbeWifi"
        >
          {{ wirelessStatus === 'checking' ? '正在检查设备…' : '检查 Wi-Fi 设备连接' }}
        </button>
        <p
          class="mt-1 text-[10px] leading-relaxed"
          :class="wirelessStatus === 'error' ? 'text-error' : 'text-muted'"
        >
          {{ wirelessMessage }}
        </p>
      </PanelSection>

      <PanelSection
        v-if="transportMode === 'usb' || transportMode === 'wifi' || transportMode === 'ble'"
        label="烧录模式"
      >
        <SegmentedControl
          v-model="burnMode"
          class="w-full"
          :options="burnModeOptions"
          label="选择烧录模式"
        />
      </PanelSection>

      <PanelSection v-if="transportMode === 'usb' && burnMode === 'frame'" label="内容来源">
        <div class="grid gap-2">
          <div class="rounded-panel border border-border bg-panel-field p-2">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-surface">当前 Frame</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{ bakeState?.name || '未选中 Frame' }} ·
                  {{ bakeSummary }}
                </p>
              </div>
              <span class="shrink-0 text-[10px] text-muted">画布</span>
            </div>
            <button
              type="button"
              class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canUsbFrameFlash"
              @click="handleUsbFrameBakeAndFlash('frame')"
            >
              {{
                usbFlashing && frameResourceSource === 'baked'
                  ? '正在烧录…'
                  : '一键烘焙并烧录当前 Frame'
              }}
            </button>
          </div>

          <div class="rounded-panel border border-border bg-panel-field p-2">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-surface">上传文件</p>
                <p class="mt-0.5 truncate text-[10px] leading-relaxed text-muted">
                  {{
                    usbSequencePayload && frameResourceSource === 'uploaded'
                      ? `${selectedImageName} · ${usbSequencePayload.frameCount} 帧 · 压缩后 ${(usbSequencePayload.storedBytes / 1024 / 1024).toFixed(2)} MiB · RLE ${usbSequencePayload.compressedFrames} 帧`
                      : selectedImageName && frameResourceSource === 'uploaded'
                        ? `${selectedImageName} · ${imagePayload?.width ?? '—'} × ${imagePayload?.height ?? '—'} · 1 帧`
                        : '单张图片，或多张 PNG 序列；20 FPS，使用稳定整帧播放'
                  }}
                </p>
              </div>
              <span class="shrink-0 text-[10px] text-muted">文件</span>
            </div>
            <label
              class="mt-2 flex h-control w-full cursor-pointer items-center justify-center rounded-panel border border-border bg-canvas px-3 text-xs font-medium text-surface hover:bg-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              选择图片或 PNG 序列
              <input
                class="sr-only"
                type="file"
                accept="image/gif,image/png,image/jpeg,image/webp,image/bmp"
                multiple
                :disabled="!canUsbFileFlash"
                @change="handleUsbImageChange"
              />
            </label>
            <button
              v-if="frameResourceSource === 'uploaded' && (imagePayload || usbSequencePayload)"
              type="button"
              class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canUsbFileFlash"
              @click="handleUsbFrameBakeAndFlash('file')"
            >
              {{ usbFlashing ? '正在烧录…' : '连接串口并烧录' }}
            </button>
          </div>
        </div>

        <p v-if="bakeError" class="mt-panel text-[11px] text-error">
          {{ bakeError }}
        </p>
        <div class="mt-panel flex items-center justify-between text-[10px]">
          <span class="text-muted">{{ buildMessage }}</span>
          <span
            class="shrink-0 pl-2"
            :class="
              buildStatus === 'error'
                ? 'text-error'
                : buildStatus === 'ready'
                  ? 'text-success'
                  : 'text-muted'
            "
          >
            {{ buildStatusLabel }}
          </span>
        </div>
      </PanelSection>

      <PanelSection v-if="transportMode === 'usb' && burnMode === 'prototype'" label="内容来源">
        <AppSelect
          v-model="selectedPrototypeSelectValue"
          :options="prototypeSelectOptions"
          :disabled="modeSwitchLocked"
          label="命名交互"
        />
        <div
          v-if="selectedPrototype"
          class="mt-panel rounded-panel border border-border bg-panel-field p-2"
        >
          <div class="flex min-w-0 items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium text-surface">
                {{ selectedPrototype.name }}
              </p>
              <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                {{ selectedPrototype.initialStateName || '未设置初始界面' }} ·
                {{ selectedPrototype.stateCount }} 个状态 · {{ selectedPrototype.width }} ×
                {{ selectedPrototype.height }}
              </p>
            </div>
            <span class="shrink-0 text-[10px] text-muted">交互</span>
          </div>
          <button
            type="button"
            class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canUsbPrototypeFlash"
            @click="handleUsbPrototypeBakeAndFlash"
          >
            {{ usbFlashing ? '正在烧录状态机…' : '一键烘焙并烧录状态机' }}
          </button>
        </div>
        <p
          v-if="prototypeReason || prototypeError"
          class="mt-panel text-[11px]"
          :class="prototypeError ? 'text-error' : 'text-muted'"
        >
          {{ prototypeError || prototypeReason }}
        </p>
        <div class="mt-panel flex items-center justify-between text-[10px]">
          <span class="text-muted">{{ buildMessage }}</span>
          <span
            class="shrink-0 pl-2"
            :class="
              buildStatus === 'error'
                ? 'text-error'
                : buildStatus === 'ready'
                  ? 'text-success'
                  : 'text-muted'
            "
          >
            {{ buildStatusLabel }}
          </span>
        </div>
      </PanelSection>

      <PanelSection v-if="transportMode === 'wifi' && burnMode === 'frame'" label="内容来源">
        <div class="grid gap-2">
          <div class="rounded-panel border border-border bg-panel-field p-2">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-surface">当前 Frame</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{ bakeState?.name || '未选中 Frame' }} ·
                  {{ bakeSummary }}
                </p>
              </div>
              <span class="shrink-0 text-[10px] text-muted">画布</span>
            </div>
            <button
              type="button"
              class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canWifiBakeAndUpload"
              @click="handleWifiBakeAndUpload"
            >
              {{ wirelessStatus === 'uploading' ? '正在传输…' : '一键烘焙并上传当前 Frame' }}
            </button>
          </div>

          <div class="rounded-panel border border-border bg-panel-field p-2">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-surface">上传文件</p>
                <p class="mt-0.5 truncate text-[10px] leading-relaxed text-muted">
                  {{
                    wifiSequencePayload && frameResourceSource === 'uploaded'
                      ? `${wifiSequencePayload.name} · ${wifiSequencePayload.frameCount} 帧 · 20 FPS · ${(wifiSequencePayload.storedBytes / 1024 / 1024).toFixed(2)} MiB`
                      : selectedImageName && frameResourceSource === 'uploaded'
                        ? `${selectedImageName} · ${imagePayload?.width ?? '—'} × ${imagePayload?.height ?? '—'} · 1 帧`
                        : '单张图片，或多张 PNG 序列；20 FPS，最大约 28.94 MiB'
                  }}
                </p>
              </div>
              <span class="shrink-0 text-[10px] text-muted">文件</span>
            </div>
            <label
              class="mt-2 flex h-control w-full cursor-pointer items-center justify-center rounded-panel border border-border bg-canvas px-3 text-xs font-medium text-surface hover:bg-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              {{ wirelessStatus === 'uploading' ? '正在传输…' : '选择图片或 PNG 序列并上传' }}
              <input
                class="sr-only"
                type="file"
                accept="image/gif,image/png,image/jpeg,image/webp,image/bmp"
                multiple
                :disabled="!canWifiFileUpload"
                @change="handleWifiImageChange"
              />
            </label>
          </div>
        </div>
        <p v-if="bakeError" class="mt-panel text-[11px] text-error">
          {{ bakeError }}
        </p>
        <p
          class="mt-panel text-[10px] leading-relaxed"
          :class="wirelessStatus === 'error' ? 'text-error' : 'text-muted'"
        >
          {{ wirelessMessage }}
        </p>
      </PanelSection>

      <PanelSection v-if="transportMode === 'wifi' && burnMode === 'prototype'" label="内容来源">
        <AppSelect
          v-model="selectedPrototypeSelectValue"
          :options="prototypeSelectOptions"
          :disabled="modeSwitchLocked"
          label="命名交互"
        />
        <div
          v-if="selectedPrototype"
          class="mt-panel rounded-panel border border-border bg-panel-field p-2"
        >
          <div class="flex min-w-0 items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-medium text-surface">
                {{ selectedPrototype.name }}
              </p>
              <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                {{ selectedPrototype.initialStateName || '未设置初始界面' }} ·
                {{ selectedPrototype.stateCount }} 个状态 · {{ selectedPrototype.width }} ×
                {{ selectedPrototype.height }}
              </p>
            </div>
            <span class="shrink-0 text-[10px] text-muted">交互</span>
          </div>
          <button
            type="button"
            class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canWifiBakeAndUpload"
            @click="handleWifiBakeAndUpload"
          >
            {{ wirelessStatus === 'uploading' ? '正在传输状态机…' : '一键烘焙并上传状态机' }}
          </button>
        </div>
        <p
          v-if="prototypeReason || prototypeError"
          class="mt-panel text-[11px]"
          :class="prototypeError ? 'text-error' : 'text-muted'"
        >
          {{ prototypeError || prototypeReason }}
        </p>
        <p
          class="mt-panel text-[10px] leading-relaxed"
          :class="wirelessStatus === 'error' ? 'text-error' : 'text-muted'"
        >
          {{ wirelessMessage }}
        </p>
      </PanelSection>

      <PanelSection v-if="transportMode === 'ble' && burnMode === 'frame'" label="内容来源">
        <div class="grid gap-2">
          <div class="rounded-panel border border-border bg-panel-field p-2">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-surface">当前 Frame</p>
                <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
                  {{ bakeState?.name || '未选中 Frame' }} ·
                  {{ bakeSummary }}
                </p>
              </div>
              <span class="shrink-0 text-[10px] text-muted">画布</span>
            </div>
            <button
              type="button"
              class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!canBleBakeAndUpload"
              @click="handleBleBakeAndUpload"
            >
              {{
                bleSession.status.value === 'uploading' && frameResourceSource === 'baked'
                  ? '正在传输…'
                  : '一键烘焙并上传当前 Frame'
              }}
            </button>
          </div>

          <div class="rounded-panel border border-border bg-panel-field p-2">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-surface">上传文件</p>
                <p class="mt-0.5 truncate text-[10px] leading-relaxed text-muted">
                  {{
                    bleSequencePayload && frameResourceSource === 'uploaded'
                      ? `${bleSequencePayload.name} · ${bleSequencePayload.frameCount} 帧 · 20 FPS · ${(bleSequencePayload.storedBytes / 1024 / 1024).toFixed(2)} MiB`
                      : selectedImageName && frameResourceSource === 'uploaded'
                        ? `${selectedImageName} · ${imagePayload?.width ?? '—'} × ${imagePayload?.height ?? '—'} · 1 帧`
                        : '单张图片，或多张 PNG 序列；20 FPS，最大约 28.94 MiB'
                  }}
                </p>
              </div>
              <span class="shrink-0 text-[10px] text-muted">文件</span>
            </div>
            <label
              class="mt-2 flex h-control w-full cursor-pointer items-center justify-center rounded-panel border border-border bg-canvas px-3 text-xs font-medium text-surface hover:bg-hover has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            >
              {{
                bleSession.status.value === 'uploading' ? '正在传输…' : '选择图片或 PNG 序列并上传'
              }}
              <input
                class="sr-only"
                type="file"
                accept="image/gif,image/png,image/jpeg,image/webp,image/bmp"
                multiple
                :disabled="!canBleFileUpload"
                @change="handleBleImageChange"
              />
            </label>
          </div>
        </div>
        <p v-if="bakeError" class="mt-panel text-[11px] text-error">
          {{ bakeError }}
        </p>
      </PanelSection>

      <PanelSection v-if="burnMode === 'prototype' && transportMode === 'ble'" label="状态机内容">
        <AppSelect
          v-model="selectedPrototypeSelectValue"
          :options="prototypeSelectOptions"
          :disabled="modeSwitchLocked"
          label="命名交互"
        />
        <div
          v-if="selectedPrototype"
          class="mt-panel grid grid-cols-[68px_minmax(0,1fr)] gap-y-1 text-[11px]"
        >
          <span class="text-muted">初始界面</span
          ><span>{{ selectedPrototype.initialStateName || '—' }}</span>
          <span class="text-muted">界面数量</span><span>{{ selectedPrototype.stateCount }}</span>
          <span class="text-muted">分辨率</span
          ><span>{{ selectedPrototype.width }} × {{ selectedPrototype.height }}</span>
        </div>
        <p
          v-if="prototypeReason || prototypeError"
          class="mt-panel text-[11px]"
          :class="prototypeError ? 'text-error' : 'text-muted'"
        >
          {{ prototypeError || prototypeReason }}
        </p>
        <button
          type="button"
          class="mt-panel h-control w-full rounded-panel border border-transparent bg-panel-field px-2 text-[11px] text-surface hover:bg-panel-field-hover disabled:opacity-50"
          :disabled="!canPreparePrototype"
          @click="handlePreparePrototype"
        >
          {{
            prototypePending
              ? '正在检查资源…'
              : prototypePrepared
                ? '资源检查通过'
                : '检查状态机资源'
          }}
        </button>
        <p class="mt-1 text-[10px] leading-relaxed text-muted">
          {{
            transportMode === 'ble'
              ? 'BLE 上传会重新烘焙全部状态，基础固件不会嵌入交互内容。'
              : '此步骤可选；生成固件时会自动重新烘焙全部状态。'
          }}
        </p>
        <button
          v-if="transportMode === 'ble'"
          type="button"
          class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canBleBakeAndUpload"
          @click="handleBleBakeAndUpload"
        >
          {{
            bleSession.status.value === 'uploading'
              ? '正在传输状态机…'
              : '烘焙并上传状态机到 BLE 设备'
          }}
        </button>
      </PanelSection>

      <PanelSection
        v-if="variables.length && transportMode === 'ble'"
        :label="`变量 · ${variables.length}`"
        :default-open="false"
      >
        <div class="grid gap-1 text-[11px]">
          <div
            v-for="variable in variables"
            :key="variable.name"
            class="flex justify-between gap-2"
          >
            <span class="truncate text-muted">{{ variable.name }}</span>
            <span class="truncate">{{ variable.value }}</span>
          </div>
        </div>
      </PanelSection>

      <PanelSection v-if="transportMode !== 'wifi-live'" label="状态日志" :default-open="false">
        <pre
          class="min-h-16 max-h-48 overflow-auto rounded-panel border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted"
          >{{ buildLog.length ? buildLog.join('\n') : buildMessage }}</pre
        >
      </PanelSection>
    </div>
  </div>
</template>
