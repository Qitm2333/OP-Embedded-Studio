<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { PanelSection } from '@/components/ui/panel'

import { prepareWifiFirmwareCredentials } from '@/features/embedded-display/adapters/http'
import { imageFileToRgb565 } from '@/features/embedded-display/adapters/image'
import { flashFirmwareManifest } from '@/features/embedded-display/adapters/manifest-firmware'
import type {
  EmbeddedDisplayProfile,
  EmbeddedFrameBakeById,
  EmbeddedFrameBakeState
} from '@/features/embedded-display/model/types'
import {
  probeWifiLivePreviewDevice,
  stopWifiLivePreview,
  uploadWifiLivePreviewFrame
} from '../adapters/wifi-live-preview'

type MirrorStatus = 'idle' | 'checking' | 'ready' | 'rendering' | 'uploading' | 'stopping' | 'error'

interface MirrorTarget {
  id: string
  name: string
  width: number
  height: number
}

const { profile, manifestUrl, bakeState, bakeFrameById } = defineProps<{
  profile?: EmbeddedDisplayProfile | null
  manifestUrl: string
  bakeState?: EmbeddedFrameBakeState
  bakeFrameById?: EmbeddedFrameBakeById
}>()

const emit = defineEmits<{
  busyChange: [busy: boolean]
}>()

const DEFAULT_WIFI_AP_SSID = 'OpenPencil-Setup'
const DEFAULT_WIFI_AP_PASSWORD = 'openpencil'
const baseUrl = ref('http://192.168.4.1')
const deviceReady = ref(false)
const deviceMessage = ref('连接设备后即可开始实时镜像')
const maintenanceOpen = ref(false)
const wifiProvisionEnabled = ref(false)
const wifiSsid = ref('')
const wifiPassword = ref('')
const initializationStatus = ref<'idle' | 'uploading' | 'success' | 'error'>('idle')
const initializationProgress = ref(0)
const initializationMessage = ref('')
const status = ref<MirrorStatus>('idle')
const active = ref(false)
const workerRunning = ref(false)
const dirty = ref(false)
const target = ref<MirrorTarget | null>(null)
const lastLatencyMs = ref<number | null>(null)
const transmittedFrames = ref(0)
const logs = ref<string[]>([])
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let workerPromise: Promise<void> | null = null

const selectedFrameReason = computed(() => {
  const state = bakeState
  if (!state?.available || !state.id) return '请直接选中一个 Frame'
  if (!profile) return '请先选择设备型号'
  if (state.width !== profile.resolution.width || state.height !== profile.resolution.height) {
    return `Frame 尺寸需为 ${profile.resolution.width} × ${profile.resolution.height}`
  }
  return ''
})

const canStart = computed(
  () =>
    !active.value &&
    !workerRunning.value &&
    deviceReady.value &&
    Boolean(bakeFrameById) &&
    selectedFrameReason.value === ''
)

const busy = computed(
  () =>
    active.value ||
    workerRunning.value ||
    status.value === 'checking' ||
    status.value === 'stopping' ||
    initializationStatus.value === 'uploading'
)

const statusLabel = computed(() => {
  if (status.value === 'checking') return '正在检查设备'
  if (status.value === 'rendering') return '正在烘焙'
  if (status.value === 'uploading') return '正在传输'
  if (status.value === 'stopping') return '正在停止'
  if (status.value === 'error') return '镜像异常'
  if (active.value) return dirty.value ? '等待下一帧' : '实时镜像中'
  if (deviceReady.value) return '设备已连接'
  return '未启动'
})

function appendLog(message: string) {
  const time = new Date().toLocaleTimeString()
  logs.value = [...logs.value.slice(-39), `[${time}] ${message}`]
}

function clearDebounce() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function scheduleFrame(delay = 180) {
  if (!active.value) return
  dirty.value = true
  if (workerRunning.value) return
  clearDebounce()
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runPendingFrame()
  }, delay)
}

async function runPendingFrame() {
  if (!active.value || !dirty.value || workerRunning.value || !target.value) return
  const requestedTarget = { ...target.value }
  const requestedProfile = profile
  const renderFrameById = bakeFrameById
  if (!requestedProfile || !renderFrameById) return

  dirty.value = false
  workerRunning.value = true
  const startedAt = performance.now()
  workerPromise = (async () => {
    status.value = 'rendering'
    const file = await renderFrameById(requestedTarget.id)
    if (!file) throw new Error(`无法烘焙 Frame：${requestedTarget.name}`)
    const payload = await imageFileToRgb565(file, requestedProfile)
    status.value = 'uploading'
    await uploadWifiLivePreviewFrame(baseUrl.value, payload)
    transmittedFrames.value += 1
    lastLatencyMs.value = Math.round(performance.now() - startedAt)
    appendLog(`已同步 ${requestedTarget.name}，耗时 ${lastLatencyMs.value}ms`)
  })()

  try {
    await workerPromise
    if (active.value) status.value = 'ready'
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    appendLog(`同步失败：${message}`)
    if (target.value?.id === requestedTarget.id) {
      active.value = false
      dirty.value = false
      status.value = 'error'
      deviceMessage.value = message
    }
  } finally {
    workerRunning.value = false
    workerPromise = null
    if (active.value && dirty.value) scheduleFrame(0)
  }
}

async function probeDevice() {
  if (status.value === 'checking') return
  status.value = 'checking'
  deviceReady.value = false
  deviceMessage.value = '正在检查实时镜像能力…'
  try {
    const device = await probeWifiLivePreviewDevice(baseUrl.value)
    if (
      profile &&
      (device.width !== profile.resolution.width || device.height !== profile.resolution.height)
    ) {
      throw new Error(`设备分辨率为 ${device.width} × ${device.height}，与当前型号不匹配`)
    }
    deviceReady.value = true
    status.value = 'ready'
    deviceMessage.value = `设备已连接：${device.width} × ${device.height}`
    appendLog('实时镜像设备连接成功')
  } catch (error) {
    status.value = 'error'
    deviceMessage.value = error instanceof Error ? error.message : String(error)
    appendLog(`连接失败：${deviceMessage.value}`)
  }
}

async function initializeFirmware() {
  const profileId = profile?.id
  if (!profileId || !manifestUrl || initializationStatus.value === 'uploading') return
  initializationStatus.value = 'uploading'
  initializationProgress.value = 0
  initializationMessage.value = '正在准备 Wi-Fi 实时镜像固件…'
  try {
    const credentials =
      wifiProvisionEnabled.value && wifiSsid.value.trim()
        ? { ssid: wifiSsid.value.trim(), password: wifiPassword.value }
        : undefined
    await prepareWifiFirmwareCredentials(profileId, credentials, 'wifi-live')
    await flashFirmwareManifest(manifestUrl, 'wifi-live', {
      preparingMessage: initializationMessage.value,
      connectedMessage: '已连接，正在初始化 Wi-Fi 实时镜像设备。',
      onLog: (message) => {
        const normalized = message.trim()
        if (normalized) {
          initializationMessage.value = normalized
          appendLog(normalized)
        }
      },
      onProgress: ({ percent }) => {
        initializationProgress.value = percent
      }
    })
    initializationStatus.value = 'success'
    initializationProgress.value = 100
    initializationMessage.value = '初始化完成；设备重启后连接 Wi-Fi 再检查设备。'
    deviceReady.value = false
  } catch (error) {
    initializationStatus.value = 'error'
    initializationMessage.value = error instanceof Error ? error.message : String(error)
    appendLog(`初始化失败：${initializationMessage.value}`)
  }
}

function startMirror() {
  const state = bakeState
  if (!canStart.value || !state) return
  target.value = { id: state.id, name: state.name, width: state.width, height: state.height }
  active.value = true
  status.value = 'ready'
  appendLog(`开始镜像 Frame：${state.name}`)
  scheduleFrame(0)
}

async function stopMirror(restoreDevice = true) {
  if (!active.value && !workerRunning.value) return
  active.value = false
  dirty.value = false
  clearDebounce()
  status.value = 'stopping'
  if (workerPromise) await workerPromise.catch(() => undefined)
  if (restoreDevice && deviceReady.value) {
    try {
      await stopWifiLivePreview(baseUrl.value)
      appendLog('已停止实时镜像并恢复设备原有内容')
    } catch (error) {
      appendLog(`停止镜像失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
  status.value = deviceReady.value ? 'ready' : 'idle'
}

watch(busy, (value) => emit('busyChange', value), { immediate: true })

watch(
  () => bakeState?.revision,
  () => {
    if (active.value) scheduleFrame()
  }
)

watch(
  () => bakeState?.id,
  () => {
    const state = bakeState
    if (!active.value || !state?.available || !state.id || state.id === target.value?.id) return
    if (
      !profile ||
      state.width !== profile.resolution.width ||
      state.height !== profile.resolution.height
    ) {
      appendLog(`忽略尺寸不匹配的 Frame：${state.name}`)
      return
    }
    target.value = { id: state.id, name: state.name, width: state.width, height: state.height }
    appendLog(`切换镜像 Frame：${state.name}`)
    scheduleFrame(0)
  }
)

watch(
  () => profile?.id,
  () => {
    deviceReady.value = false
    target.value = null
    void stopMirror(false)
  }
)

onBeforeUnmount(() => {
  clearDebounce()
  void stopMirror(true)
})
</script>

<template>
  <PanelSection
    label="首次使用 / 设备维护"
    :open="maintenanceOpen"
    @update:open="maintenanceOpen = $event"
  >
    <p class="text-[10px] leading-relaxed text-muted">
      实时镜像能力已包含在统一 Wi-Fi 固件中。只有首次使用或固件升级时需要通过 USB 初始化。
    </p>
    <label class="mt-panel flex items-center gap-2 text-[11px] text-surface">
      <input
        v-model="wifiProvisionEnabled"
        type="checkbox"
        class="accent-accent"
        :disabled="busy"
      />
      <span>同时写入局域网 Wi-Fi（可选）</span>
    </label>
    <div v-if="wifiProvisionEnabled" class="mt-1.5 grid gap-1.5">
      <input
        v-model="wifiSsid"
        class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
        :disabled="busy"
        type="text"
        maxlength="32"
        placeholder="局域网 Wi-Fi 名称（SSID）"
      />
      <input
        v-model="wifiPassword"
        class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
        :disabled="busy"
        type="password"
        maxlength="64"
        placeholder="局域网 Wi-Fi 密码（可为空）"
      />
    </div>
    <button
      type="button"
      class="mt-1.5 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="!manifestUrl || initializationStatus === 'uploading'"
      @click="initializeFirmware"
    >
      {{
        initializationStatus === 'uploading'
          ? `正在初始化：${initializationProgress}%`
          : '通过 USB 初始化实时镜像设备'
      }}
    </button>
    <div
      v-if="initializationStatus !== 'idle'"
      class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-field"
    >
      <div
        class="h-full transition-[width]"
        :class="initializationStatus === 'error' ? 'bg-error' : 'bg-accent'"
        :style="{ width: initializationProgress + '%' }"
      />
    </div>
    <p
      class="mt-1 text-[10px] leading-relaxed"
      :class="initializationStatus === 'error' ? 'text-error' : 'text-muted'"
    >
      {{
        initializationMessage ||
        (manifestUrl
          ? 'Wi-Fi 实时镜像固件已完备；连接 USB 后可直接初始化。'
          : '预置 Wi-Fi 固件缺失，请检查后端固件资源。')
      }}
    </p>
  </PanelSection>

  <PanelSection label="Wi-Fi 实时镜像设备">
    <input
      v-model="baseUrl"
      class="h-control w-full rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
      :disabled="busy"
      type="url"
      placeholder="http://192.168.4.1"
    />
    <p class="mt-1 text-[10px] text-muted">
      默认热点：{{ DEFAULT_WIFI_AP_SSID }} / {{ DEFAULT_WIFI_AP_PASSWORD }}
    </p>
    <button
      type="button"
      class="mt-1.5 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="status === 'checking' || active"
      @click="probeDevice"
    >
      {{ status === 'checking' ? '正在检查…' : deviceReady ? '重新检查设备' : '检查并连接设备' }}
    </button>
    <p
      class="mt-1 text-[10px] leading-relaxed"
      :class="status === 'error' ? 'text-error' : 'text-muted'"
    >
      {{ deviceMessage }}
    </p>
  </PanelSection>

  <PanelSection label="实时镜像">
    <div class="rounded-panel border border-border bg-panel-field p-2">
      <div class="flex min-w-0 items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium text-surface">
            {{ target?.name || bakeState?.name || '未选择 Frame' }}
          </p>
          <p class="mt-0.5 text-[10px] leading-relaxed text-muted">
            {{
              target
                ? `固定镜像 · ${target.width} × ${target.height}`
                : selectedFrameReason || `${bakeState?.width} × ${bakeState?.height}`
            }}
          </p>
        </div>
        <span class="shrink-0 text-[10px]" :class="active ? 'text-success' : 'text-muted'">
          {{ statusLabel }}
        </span>
      </div>
      <button
        v-if="!active"
        type="button"
        class="mt-2 h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="!canStart"
        @click="startMirror"
      >
        开始实时镜像
      </button>
      <button
        v-else
        type="button"
        class="mt-2 h-control w-full rounded-panel border border-border bg-canvas px-3 text-xs font-medium text-surface hover:bg-hover disabled:opacity-50"
        :disabled="status === 'stopping'"
        @click="stopMirror(true)"
      >
        {{ status === 'stopping' ? '正在停止…' : '停止实时镜像' }}
      </button>
    </div>
    <p class="mt-1 text-[10px] leading-relaxed text-muted">
      镜像启动后固定当前 Frame；直接选中另一个 Frame 时才会切换目标，选择内部元素不会改变目标。
    </p>
    <div class="mt-panel grid grid-cols-2 gap-2 text-[10px]">
      <div class="rounded-panel border border-border bg-canvas px-2 py-1.5">
        <p class="text-muted">已同步帧数</p>
        <p class="mt-0.5 text-xs text-surface">{{ transmittedFrames }}</p>
      </div>
      <div class="rounded-panel border border-border bg-canvas px-2 py-1.5">
        <p class="text-muted">最近耗时</p>
        <p class="mt-0.5 text-xs text-surface">
          {{ lastLatencyMs === null ? '—' : `${lastLatencyMs} ms` }}
        </p>
      </div>
    </div>
  </PanelSection>

  <PanelSection label="镜像日志" :default-open="false">
    <pre
      class="min-h-16 max-h-48 overflow-auto rounded-panel border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted"
      >{{ logs.length ? logs.join('\n') : '等待启动实时镜像' }}</pre
    >
  </PanelSection>
</template>
