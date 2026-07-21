<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import 'esp-web-tools/dist/install-button.js'

import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { PanelHeader, PanelSection } from '@/components/ui/panel'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

import { probeWirelessDevice, uploadWirelessImage } from '../adapters/wireless'
import { useBleDeviceSession } from '../composables/useBleDeviceSession'
import { useEmbeddedDisplay } from '../composables/useEmbeddedDisplay'
import type {
  EmbeddedBuildMode,
  EmbeddedBuildStatus,
  EmbeddedFrameBake,
  EmbeddedFrameBakeState,
  EmbeddedPrototypeBake,
  EmbeddedPrototypeOption
} from '../model/types'

const props = defineProps<{
  bakeState?: EmbeddedFrameBakeState
  bakeFrame?: EmbeddedFrameBake
  bakePrototype?: EmbeddedPrototypeBake
  prototypeOptions?: EmbeddedPrototypeOption[]
}>()

const burnMode = ref<'frame' | 'prototype'>('frame')
const transportMode = ref<'usb' | 'wifi' | 'ble'>('usb')
const wifiProvisionEnabled = ref(false)
const wifiSsid = ref('')
const wifiPassword = ref('')
const bleSession = useBleDeviceSession()
const wirelessBaseUrl = ref('http://192.168.4.1')
const wirelessStatus = ref<'idle' | 'checking' | 'uploading' | 'success' | 'error'>('idle')
const wirelessMessage = ref('连接设备后，可直接传输当前图片')
const wirelessDeviceReady = ref(false)
const wifiBaseFirmwareReady = ref(false)
const DEFAULT_WIFI_AP_SSID = 'OpenPencil-Setup'
const DEFAULT_WIFI_AP_PASSWORD = 'openpencil'
const deviceDetailsOpen = ref(false)
const selectedPrototypeId = ref('')
const bakePending = ref(false)
const bakeError = ref('')
const frameResourceSource = ref<'baked' | 'uploaded' | null>(null)
const prototypePending = ref(false)
const prototypePrepared = ref(false)
const prototypeError = ref('')
const {
  selectedProfile,
  profiles,
  variables,
  selectedImageName,
  imagePayload,
  previewUrl,
  buildStatus,
  buildMessage,
  buildLog,
  manifestUrl,
  serviceAvailable,
  selectProfile,
  selectImage,
  selectPrototype,
  buildFirmware,
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
const burnModeOptions = [
  { value: 'frame', label: '单 Frame' },
  { value: 'prototype', label: '状态机' }
]
const transportOptions = [
  { value: 'usb', label: 'USB 串口' },
  { value: 'wifi', label: 'Wi-Fi 无线' },
  { value: 'ble', label: 'BLE 蓝牙' }
]
const profileOptions = computed(() =>
  profiles.value.map((profile) => ({ value: profile.id, label: profile.name }))
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
  if (!props.bakeState) return '请在画布中选中一个 Frame'
  if (!props.bakeState.available) return props.bakeState.reason || '当前选择无法烘焙'
  if (!selectedProfile.value) return '请先选择屏幕方案'
  if (
    props.bakeState.width !== selectedProfile.value.resolution.width ||
    props.bakeState.height !== selectedProfile.value.resolution.height
  ) {
    return `Frame 尺寸需为 ${selectedProfile.value.resolution.width} × ${selectedProfile.value.resolution.height}`
  }
  return props.bakeState.reason || ''
})
const prototypeReason = computed(() => {
  if (!selectedPrototype.value) return '请先选择一个命名交互'
  if (!selectedPrototype.value.valid) return selectedPrototype.value.reason || '交互定义不完整'
  if (!selectedProfile.value) return '请先选择屏幕方案'
  if (
    selectedPrototype.value.width !== selectedProfile.value.resolution.width ||
    selectedPrototype.value.height !== selectedProfile.value.resolution.height
  ) {
    return `交互中的 Frame 尺寸需为 ${selectedProfile.value.resolution.width} × ${selectedProfile.value.resolution.height}`
  }
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
    transportMode.value === 'usb' &&
    Boolean(props.bakePrototype && selectedPrototype.value) &&
    prototypeReason.value === '' &&
    !prototypePending.value &&
    !['uploading', 'building'].includes(buildStatus.value)
)
const canBuild = computed(() => {
  if (!serviceAvailable.value || !selectedProfile.value || selectedProfile.value.imageOnly || bakePending.value || prototypePending.value || ['loading', 'uploading', 'building'].includes(buildStatus.value)) {
    return false
  }
  if (transportMode.value === 'wifi') {
    return burnMode.value === 'frame' && (!wifiProvisionEnabled.value || Boolean(wifiSsid.value.trim()))
  }
  if (transportMode.value === 'ble') {
    return burnMode.value === 'frame'
  }
  return burnMode.value === 'frame' || Boolean(selectedPrototype.value && !prototypeReason.value)
})
const canWirelessUpload = computed(
  () =>
    transportMode.value !== 'usb' &&
    burnMode.value === 'frame' &&
    Boolean(imagePayload.value) &&
    (transportMode.value === 'ble'
      ? bleSession.deviceReady.value || bleSession.canReconnect.value
      : wirelessDeviceReady.value) &&
    (transportMode.value === 'ble' ? bleSession.status.value : wirelessStatus.value) !== 'checking' &&
    (transportMode.value === 'ble' ? bleSession.status.value : wirelessStatus.value) !== 'uploading'
)
const wifiCredentials = computed(() =>
  wifiProvisionEnabled.value && wifiSsid.value.trim()
    ? { ssid: wifiSsid.value.trim(), password: wifiPassword.value }
    : undefined
)
const wifiFoundationLabel = computed(() => {
  if (wirelessDeviceReady.value) return '设备已验证'
  if (wifiBaseFirmwareReady.value) return '待烧录并验证'
  return '待创建基础固件'
})

watch(
  () => props.prototypeOptions,
  (options) => {
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

async function handleBakeFrame() {
  if (!props.bakeFrame || !canBake.value) return
  bakePending.value = true
  bakeError.value = ''
  try {
    const file = await props.bakeFrame()
    if (file) {
      await selectImage(file, { upload: transportMode.value !== 'wifi' })
      frameResourceSource.value = 'baked'
    }
  } catch (error) {
    bakeError.value = error instanceof Error ? error.message : String(error)
  } finally {
    bakePending.value = false
  }
}

function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  frameResourceSource.value = file ? 'uploaded' : null
  void selectImage(file, { upload: transportMode.value !== 'wifi' })
}

async function preparePrototypeResources() {
  if (!props.bakePrototype || !selectedPrototype.value || prototypeReason.value) return false
  prototypePending.value = true
  prototypePrepared.value = false
  prototypeError.value = ''
  try {
    const bake = await props.bakePrototype(selectedPrototypeId.value)
    if (!bake) throw new Error('无法读取所选交互')
    await selectPrototype(bake)
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

async function handleBuildFirmware() {
  if (!canBuild.value) return

  // Firmware builds consume generated headers on the local build service. A Frame
  // build must refresh the current canvas resource; otherwise a stale generated
  // header can silently compile the built-in geometry test image.
  if (transportMode.value === 'usb' && burnMode.value === 'prototype') {
    if (!(await preparePrototypeResources())) return
  } else if (transportMode.value !== 'wifi' && transportMode.value !== 'ble' && frameResourceSource.value !== 'uploaded') {
    if (!props.bakeFrame || bakeReason.value) {
      bakeError.value = bakeReason.value || '无法重新烘焙当前 Frame'
      return
    }
    bakePending.value = true
    bakeError.value = ''
    try {
      const file = await props.bakeFrame()
      if (!file) throw new Error('无法重新烘焙当前 Frame')
      await selectImage(file)
    } catch (error) {
      bakeError.value = error instanceof Error ? error.message : String(error)
      return
    } finally {
      bakePending.value = false
    }
  }

  const buildMode = `${transportMode.value}-${burnMode.value}` as EmbeddedBuildMode
  const buildSucceeded = await buildFirmware(
    buildMode,
    transportMode.value === 'wifi' ? wifiCredentials.value : undefined
  )
  if (!buildSucceeded) return
  if (buildMode === 'wifi-frame') {
    wifiBaseFirmwareReady.value = true
    wirelessDeviceReady.value = false
    wirelessMessage.value = '基础固件已生成；烧录完成后请检查设备连接'
  } else if (buildMode === 'ble-frame') {
    bleSession.markFirmwareBuilt('基础固件已生成；请先通过 USB 烧录，再连接 BLE 设备')
  }
}

async function handleProbeWireless() {
  if (transportMode.value === 'ble') {
    if (selectedProfile.value) await bleSession.probe(selectedProfile.value)
    return
  }
  wirelessStatus.value = 'checking'
  wirelessMessage.value = '正在检查设备连接…'
  try {
    const device = await probeWirelessDevice(wirelessBaseUrl.value)
    if (!selectedProfile.value) throw new Error('请先选择设备型号')
    if (
      device.width !== selectedProfile.value.resolution.width ||
      device.height !== selectedProfile.value.resolution.height
    ) {
      throw new Error(
        `设备分辨率为 ${device.width} × ${device.height}，与当前方案 ${selectedProfile.value.resolution.width} × ${selectedProfile.value.resolution.height} 不匹配`
      )
    }
    wirelessDeviceReady.value = true
    wifiBaseFirmwareReady.value = true
    wirelessStatus.value = 'success'
    wirelessMessage.value = `设备已连接：${device.width} × ${device.height}${device.ip ? `，Wi-Fi 地址 ${device.ip}` : ''}`
  } catch (error) {
    wirelessStatus.value = 'error'
    wirelessMessage.value = error instanceof Error ? error.message : String(error)
  }
}

async function handleWirelessUpload() {
  if (!imagePayload.value || !selectedProfile.value || !canWirelessUpload.value) return
  if (transportMode.value === 'ble') {
    await bleSession.upload(imagePayload.value)
    return
  }
  wirelessStatus.value = 'uploading'
  wirelessMessage.value = '正在通过 Wi-Fi 传输图片…'
  try {
    await uploadWirelessImage(wirelessBaseUrl.value, imagePayload.value)
    wirelessStatus.value = 'success'
    wirelessMessage.value = '图片已传输，设备将重启并加载新内容'
  } catch (error) {
    wirelessStatus.value = 'error'
    wirelessMessage.value = error instanceof Error ? error.message : String(error)
  }
}

watch(transportMode, (mode) => {
  wirelessDeviceReady.value = false
  if (mode === 'ble') {
    bleSession.reset()
    void loadCachedFirmware('ble-frame').then((available) => {
      bleSession.setBaseFirmwareReady(available)
    })
  } else if (mode === 'wifi') {
    void loadCachedFirmware('wifi-frame').then((available) => {
      wifiBaseFirmwareReady.value = available
    })
  } else {
    wirelessStatus.value = 'idle'
    wirelessMessage.value = '切换到 Wi-Fi 后可检查设备并传输图片'
  }
})

watch([wifiSsid, wifiPassword], () => {
  wifiBaseFirmwareReady.value = false
})

watch(
  () => selectedProfile.value?.id,
  (profileId) => {
    wirelessDeviceReady.value = false
    wifiBaseFirmwareReady.value = false
    bleSession.reset()
    if (!profileId) return
    if (transportMode.value === 'ble') {
      void loadCachedFirmware('ble-frame').then((available) => {
        bleSession.setBaseFirmwareReady(available)
      })
    } else if (transportMode.value === 'wifi') {
      void loadCachedFirmware('wifi-frame').then((available) => {
        wifiBaseFirmwareReady.value = available
      })
    }
  }
)
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
          {{ serviceAvailable ? '已连接' : '未连接' }}
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
          label="设备型号"
          @update:model-value="selectProfile"
        />
        <p v-else class="text-[11px] text-muted">{{ buildMessage }}</p>

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
        <SegmentedControl v-model="transportMode" class="w-full" :options="transportOptions" label="选择传输方式" />
      </PanelSection>

      <PanelSection v-if="transportMode === 'ble'" label="BLE 基础固件">
        <div class="grid gap-1.5">
          <div class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-1.5 text-[11px]"><span class="text-muted">1. 创建 BLE 基础固件</span><span :class="bleSession.baseFirmwareReady.value ? 'text-success' : 'text-muted'">{{ bleSession.baseFirmwareReady.value ? '已生成' : '待创建' }}</span></div>
          <div class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-1.5 text-[11px]"><span class="text-muted">2. USB 烧录并启动 BLE</span><span :class="bleSession.deviceReady.value ? 'text-success' : 'text-muted'">{{ bleSession.deviceReady.value ? '已连接' : '待烧录/连接' }}</span></div>
        </div>
        <button type="button" class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canBuild" @click="handleBuildFirmware">{{ buildStatus === 'building' ? '正在创建 BLE 固件…' : '1. 创建 BLE 基础固件' }}</button>
        <esp-web-install-button v-if="manifestUrl" :manifest="manifestUrl" class="mt-1.5 block"><button slot="activate" type="button" class="h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white">2. USB 烧录 BLE 固件</button></esp-web-install-button>
        <button type="button" class="mt-panel h-control w-full rounded-panel border border-transparent bg-panel-field px-2 text-[11px] text-surface hover:bg-panel-field-hover disabled:opacity-50" :disabled="bleSession.status.value === 'checking'" @click="handleProbeWireless">{{ bleSession.status.value === 'checking' ? '等待选择 BLE 设备…' : '3. 连接 BLE 设备' }}</button>
        <p class="mt-1 text-[10px] leading-relaxed" :class="bleSession.status.value === 'error' ? 'text-error' : 'text-muted'">{{ bleSession.message.value }}</p>
        <div v-if="bleSession.status.value === 'uploading'" class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-field"><div class="h-full bg-accent transition-[width]" :style="{ width: bleSession.progress.value + '%' }" /></div>
        <button type="button" class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canWirelessUpload" @click="handleWirelessUpload">{{ bleSession.status.value === 'uploading' ? '正在传输…' : '4. 上传图片到设备' }}</button>
      </PanelSection>

      <PanelSection v-if="transportMode === 'wifi'" label="Wi-Fi 基础固件">
        <div class="grid gap-1.5">
          <div class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-1.5 text-[11px]"><span class="text-muted">1. 创建基础固件</span><span :class="wifiBaseFirmwareReady ? 'text-success' : 'text-muted'">{{ wifiBaseFirmwareReady ? '已生成' : '待创建' }}</span></div>
          <div class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-1.5 text-[11px]"><span class="text-muted">2. 烧录并显示诊断图</span><span :class="wirelessDeviceReady ? 'text-success' : 'text-muted'">{{ wifiFoundationLabel }}</span></div>
          <div class="flex items-center justify-between rounded-panel border border-border bg-panel-field px-2 py-1.5 text-[11px]"><span class="text-muted">3. 连接设备</span><span :class="wirelessDeviceReady ? 'text-success' : 'text-muted'">{{ wirelessDeviceReady ? '已连接' : '待检查' }}</span></div>
        </div>
        <div class="mt-panel rounded-panel border border-border bg-panel-field px-2 py-2 text-[11px]"><p class="text-surface">默认设备热点</p><p class="mt-1 text-muted">名称：{{ DEFAULT_WIFI_AP_SSID }}</p><p class="text-muted">密码：{{ DEFAULT_WIFI_AP_PASSWORD }}</p><p class="mt-1 leading-relaxed text-muted">烧录基础固件后，设备会开启这个热点。电脑连接后，再检查设备并上传 Frame。</p></div>
        <label class="mt-panel flex items-center gap-2 text-[11px] text-surface"><input v-model="wifiProvisionEnabled" type="checkbox" class="accent-accent" /><span>同时写入局域网 Wi-Fi（可选）</span></label>
        <div v-if="wifiProvisionEnabled" class="mt-1.5 grid gap-1.5"><input v-model="wifiSsid" class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent" type="text" maxlength="32" placeholder="局域网 Wi-Fi 名称（SSID）" aria-label="局域网 Wi-Fi 名称" /><input v-model="wifiPassword" class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent" type="password" maxlength="64" placeholder="局域网 Wi-Fi 密码（可为空）" aria-label="局域网 Wi-Fi 密码" /></div>
        <button type="button" class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canBuild" @click="handleBuildFirmware">{{ buildStatus === 'building' ? '正在创建基础固件…' : '1. 创建 Wi-Fi 基础固件' }}</button>
        <esp-web-install-button v-if="manifestUrl" :manifest="manifestUrl" class="mt-1.5 block"><button slot="activate" type="button" class="h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white">2. 烧录基础固件</button></esp-web-install-button>
        <div class="mt-panel grid gap-1.5 border-t border-border pt-panel"><p class="text-[10px] leading-relaxed text-muted">烧录后屏幕会显示棋盘格和十字诊断图，用于确认屏幕、分辨率和固件启动正常。</p><input v-model="wirelessBaseUrl" class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent" type="url" placeholder="http://192.168.4.1" aria-label="设备地址" /><button type="button" class="h-control w-full rounded-panel border border-transparent bg-panel-field px-2 text-[11px] text-surface hover:bg-panel-field-hover disabled:opacity-50" :disabled="wirelessStatus === 'checking'" @click="handleProbeWireless">{{ wirelessStatus === 'checking' ? '检查中…' : '3. 检查设备连接' }}</button><p class="text-[10px] leading-relaxed" :class="wirelessStatus === 'error' ? 'text-error' : 'text-muted'">{{ wirelessMessage }}</p></div>
      </PanelSection>

      <PanelSection label="烧录模式">
        <SegmentedControl
          v-model="burnMode"
          class="w-full"
          :options="burnModeOptions"
          label="选择烧录模式"
        />
      </PanelSection>

      <PanelSection v-if="burnMode === 'frame'" label="Frame 内容">
        <div class="flex min-w-0 items-center gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs text-surface">{{ bakeState?.name || '未选中 Frame' }}</p>
            <p class="mt-0.5 text-[11px] text-muted">
              {{ bakeReason || `${bakeState?.width} × ${bakeState?.height}，尺寸匹配` }}
            </p>
          </div>
          <button
            type="button"
            class="h-control shrink-0 rounded-panel border border-transparent bg-panel-field px-2 text-[11px] text-surface hover:bg-panel-field-hover disabled:opacity-50"
            :disabled="!canBake"
            @click="handleBakeFrame"
          >
            {{ bakePending ? '烘焙中…' : '烘焙' }}
          </button>
        </div>
        <p v-if="bakeError" class="mt-panel text-[11px] text-error">{{ bakeError }}</p>
      </PanelSection>

      <PanelSection v-else label="状态机内容">
        <AppSelect
          v-model="selectedPrototypeSelectValue"
          :options="prototypeSelectOptions"
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
          此步骤可选；生成固件时会自动重新烘焙全部状态。
        </p>
      </PanelSection>

      <PanelSection v-if="burnMode === 'frame'" label="图片与预览" :default-open="false">
        <label
          class="flex cursor-pointer flex-col rounded-panel border border-dashed border-border px-2 py-2 hover:bg-hover"
        >
          <span class="truncate text-xs text-surface">{{
            selectedImageName || '选择外部图片素材'
          }}</span>
          <span class="mt-0.5 text-[10px] text-muted">GIF、PNG、JPG、WebP、BMP</span>
          <input
            class="sr-only"
            type="file"
            accept="image/gif,image/png,image/jpeg,image/webp,image/bmp"
            @change="handleImageChange"
          />
        </label>
        <div
          class="mt-panel flex aspect-square max-h-40 items-center justify-center overflow-hidden rounded-panel border border-border"
          :style="{ backgroundColor: selectedProfile?.backgroundColor ?? '#F5F5F5' }"
        >
          <img
            v-if="previewUrl"
            :src="previewUrl"
            alt="图片预览"
            class="size-full object-contain"
            :style="{ borderRadius: selectedProfile?.visibleArea?.shape === 'round' ? '50%' : '0' }"
          />
          <span v-else class="text-[11px] text-muted">{{ resolutionLabel }}</span>
        </div>
        <button
          v-if="transportMode === 'wifi'"
          type="button"
          class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canWirelessUpload"
          @click="handleWirelessUpload"
        >
          {{ wirelessStatus === 'uploading' ? '正在传输…' : '4. 上传图片到设备' }}
        </button>
        <p v-if="transportMode === 'wifi'" class="mt-1 text-[10px] leading-relaxed text-muted">
          只有完成基础固件烧录并检查设备后，才可以上传 Frame。
        </p>
      </PanelSection>

      <PanelSection
        v-if="variables.length"
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

      <PanelSection v-if="transportMode === 'usb'" label="构建与烧录">
        <div class="mb-panel flex items-center justify-between text-[11px]"><span class="text-muted">当前状态</span><span :class="buildStatus === 'error' ? 'text-error' : buildStatus === 'ready' ? 'text-success' : 'text-surface'">{{ buildStatusLabel }}</span></div>
        <p class="mb-panel text-[11px] leading-relaxed text-muted">{{ buildMessage }}</p>
        <button type="button" class="h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canBuild" @click="handleBuildFirmware">{{ buildStatus === 'building' ? '正在生成固件…' : '生成 USB 固件' }}</button>
        <esp-web-install-button v-if="manifestUrl" :manifest="manifestUrl" class="mt-1.5 block"><button slot="activate" type="button" class="h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white">连接设备并烧录</button></esp-web-install-button>
      </PanelSection>

      <PanelSection label="构建日志" :default-open="false">
        <pre
          class="min-h-16 max-h-48 overflow-auto rounded-panel border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted"
          >{{ buildLog.length ? buildLog.join('\n') : buildMessage }}</pre
        >
      </PanelSection>
    </div>
  </div>
</template>
