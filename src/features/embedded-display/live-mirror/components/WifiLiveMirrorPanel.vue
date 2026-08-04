<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import IconButton from '@/components/ui/IconButton.vue'
import { PanelSection } from '@/components/ui/panel'

import {
  imageFileToRgb565,
  type EmbeddedImagePlacement
} from '@/features/embedded-display/adapters/image'
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

const { profile, bakeState, bakeFrameById, backgroundColor, placement } = defineProps<{
  profile?: EmbeddedDisplayProfile | null
  bakeState?: EmbeddedFrameBakeState
  bakeFrameById?: EmbeddedFrameBakeById
  backgroundColor?: string
  placement?: EmbeddedImagePlacement
}>()

const emit = defineEmits<{
  busyChange: [busy: boolean]
}>()

const DEFAULT_WIFI_AP_SSID = 'OP-Embedded-Setup'
const DEFAULT_WIFI_AP_PASSWORD = 'opembedded'
const baseUrl = ref('http://192.168.4.1')
const deviceReady = ref(false)
const deviceMessage = ref('连接设备后即可开始实时镜像')
const connectionSettingsOpen = ref(false)
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
  if (!state?.available || !state.id) return '请选择一个 Frame 或 Frame 内的元素'
  if (!profile) return '请先选择设备型号'
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
    status.value === 'stopping'
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
    const payload = await imageFileToRgb565(file, requestedProfile, {
      placement,
      backgroundColor
    })
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

function startMirror() {
  const state = bakeState
  if (!canStart.value || !state) return
  target.value = {
    id: state.id,
    name: state.name,
    width: state.width,
    height: state.height
  }
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
    if (!profile) return
    target.value = {
      id: state.id,
      name: state.name,
      width: state.width,
      height: state.height
    }
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
  <PanelSection label="设备连接">
    <template #actions>
      <IconButton
        label="连接设置"
        :active="connectionSettingsOpen"
        @click="connectionSettingsOpen = !connectionSettingsOpen"
      >
        <icon-lucide-settings-2 class="size-3.5" />
      </IconButton>
    </template>
    <div
      class="flex items-center justify-between gap-2 rounded-panel border border-border bg-panel-field p-2 text-[11px]"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="size-2 shrink-0 rounded-full"
          :class="deviceReady ? 'bg-success' : 'bg-muted'"
        />
        <span class="truncate text-surface">{{ DEFAULT_WIFI_AP_SSID }}</span>
      </div>
      <span class="shrink-0 text-muted">{{ DEFAULT_WIFI_AP_PASSWORD }}</span>
    </div>
    <div v-if="connectionSettingsOpen" class="mt-panel grid gap-1.5">
      <input
        v-model="baseUrl"
        class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent disabled:opacity-50"
        :disabled="busy"
        type="url"
        placeholder="设备地址"
        aria-label="实时镜像设备地址"
      />
    </div>
    <button
      type="button"
      class="mt-panel h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="status === 'checking' || active"
      @click="probeDevice"
    >
      {{ status === 'checking' ? '正在检查…' : deviceReady ? '重新检查设备' : '检查设备' }}
    </button>
    <p v-if="status === 'error'" class="mt-1 text-[10px] text-error">
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
    <div v-if="active" class="mt-1.5 flex items-center justify-between text-[10px] text-muted">
      <span>{{ transmittedFrames }} 帧</span>
      <span>{{ lastLatencyMs === null ? '—' : `${lastLatencyMs} ms` }}</span>
    </div>
  </PanelSection>

  <PanelSection label="状态日志" :default-open="false">
    <pre
      class="min-h-16 max-h-48 overflow-auto rounded-panel border border-border bg-canvas p-2 text-[10px] leading-relaxed text-muted"
      >{{ logs.length ? logs.join('\n') : '等待启动实时镜像' }}</pre
    >
  </PanelSection>
</template>
