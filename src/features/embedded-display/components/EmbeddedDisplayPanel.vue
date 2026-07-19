<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import 'esp-web-tools/dist/install-button.js'

import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { PanelHeader, PanelSection } from '@/components/ui/panel'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'

import { probeWirelessDevice, uploadWirelessImage } from '../adapters/wireless'
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
const transportMode = ref<'usb' | 'wifi'>('usb')
const wifiProvisionEnabled = ref(false)
const wifiSsid = ref('')
const wifiPassword = ref('')
const wirelessBaseUrl = ref('http://192.168.4.1')
const wirelessStatus = ref<'idle' | 'checking' | 'uploading' | 'success' | 'error'>('idle')
const wirelessMessage = ref('连接设备后，可直接传输当前图片')
const wirelessDeviceReady = ref(false)
const wifiBaseFirmwareReady = ref(false)
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
  { value: 'wifi', label: 'Wi-Fi 无线' }
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
  if (
    !serviceAvailable.value ||
    !selectedProfile.value ||
    selectedProfile.value.imageOnly ||
    bakePending.value ||
    prototypePending.value ||
    ['loading', 'uploading', 'building'].includes(buildStatus.value)
  ) {
    return false
  }

  if (transportMode.value === 'wifi') {
    return burnMode.value === 'frame' && wifiProvisionEnabled.value && Boolean(wifiSsid.value.trim())
  }

  return burnMode.value === 'frame' || Boolean(selectedPrototype.value && !prototypeReason.value)
})
const canWirelessUpload = computed(
  () =>
    transportMode.value === 'wifi' &&
    burnMode.value === 'frame' &&
    Boolean(imagePayload.value) &&
    wirelessDeviceReady.value &&
    wirelessStatus.value !== 'checking' &&
    wirelessStatus.value !== 'uploading'
)
const wifiCredentials = computed(() =>
  wifiProvisionEnabled.value && wifiSsid.value.trim()
    ? { ssid: wifiSsid.value.trim(), password: wifiPassword.value }
    : undefined
)

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
  } else if (transportMode.value !== 'wifi' && frameResourceSource.value !== 'uploaded') {
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
  }
}

async function handleProbeWireless() {
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
  if (mode !== 'wifi') {
    wirelessStatus.value = 'idle'
    wirelessMessage.value = '切换到 Wi-Fi 后可检查设备并传输图片'
  }
})

watch([wifiSsid, wifiPassword], () => {
  wifiBaseFirmwareReady.value = false
})

watch(
  () => selectedProfile.value?.id,
  () => {
    wirelessDeviceReady.value = false
    wifiBaseFirmwareReady.value = false
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
        <SegmentedControl
          v-model="transportMode"
          class="w-full"
          :options="transportOptions"
          label="选择传输方式"
        />
        <div v-if="transportMode === 'wifi'" class="mt-panel grid gap-1.5">
          <label class="flex items-center gap-2 text-[11px] text-surface">
            <input v-model="wifiProvisionEnabled" type="checkbox" class="accent-accent" />
            <span>首次烧录时写入 Wi-Fi 配置</span>
          </label>
          <template v-if="wifiProvisionEnabled">
            <input
              v-model="wifiSsid"
              class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent"
              type="text"
              maxlength="32"
              placeholder="Wi-Fi 名称（SSID）"
              aria-label="Wi-Fi 名称"
            />
            <input
              v-model="wifiPassword"
              class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent"
              type="password"
              maxlength="64"
              placeholder="Wi-Fi 密码（可为空）"
              aria-label="Wi-Fi 密码"
            />
          </template>
          <template v-if="burnMode === 'frame'">
            <p class="text-[10px] leading-relaxed text-muted">
              {{
                wifiBaseFirmwareReady
                  ? '基础固件已准备；烧录后检查设备，再传输图片。'
                  : '先生成并烧录 Wi-Fi 基础固件，图片随后单独通过网络传输。'
              }}
            </p>
            <input
              v-model="wirelessBaseUrl"
              class="h-control rounded-panel border border-border bg-panel-field px-2 text-xs text-surface outline-none focus:border-accent"
              type="url"
              placeholder="http://192.168.4.1"
              aria-label="设备 Wi-Fi 地址"
            />
            <div class="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                class="h-control rounded-panel border border-transparent bg-panel-field px-2 text-[11px] text-surface hover:bg-panel-field-hover disabled:opacity-50"
                :disabled="wirelessStatus === 'checking'"
                @click="handleProbeWireless"
              >
                {{ wirelessStatus === 'checking' ? '检查中…' : '检查连接' }}
              </button>
              <button
                type="button"
                class="h-control rounded-panel bg-accent px-2 text-[11px] text-white disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canWirelessUpload"
                @click="handleWirelessUpload"
              >
                {{ wirelessStatus === 'uploading' ? '传输中…' : '传输图片' }}
              </button>
            </div>
            <p
              class="text-[10px] leading-relaxed"
              :class="wirelessStatus === 'error' ? 'text-error' : 'text-muted'"
            >
              {{ wirelessMessage }}
            </p>
          </template>
          <p v-if="burnMode === 'prototype'" class="text-[10px] leading-relaxed text-muted">
            Wi-Fi 状态机传输协议暂未启用；USB 状态机流程不受影响。
          </p>
          <p v-else class="text-[10px] leading-relaxed text-muted">
            Wi-Fi 模式分两步：先烧录带配置的基础固件，再通过 Wi-Fi 传输当前图片。USB 烧录和 Wi-Fi 传图使用不同协议。
          </p>
        </div>
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

      <PanelSection label="构建与烧录">
        <div class="mb-panel flex items-center justify-between text-[11px]">
          <span class="text-muted">当前状态</span>
          <span
            :class="
              buildStatus === 'error'
                ? 'text-error'
                : buildStatus === 'ready'
                  ? 'text-success'
                  : 'text-surface'
            "
          >
            {{ buildStatusLabel }}
          </span>
        </div>
        <p class="mb-panel text-[11px] leading-relaxed text-muted">{{ buildMessage }}</p>

        <div class="grid gap-1.5">
          <button
            type="button"
            class="h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canBuild"
            @click="handleBuildFirmware"
          >
            1.
            {{
              buildStatus === 'building'
                ? '正在生成固件…'
                : transportMode === 'wifi' && burnMode === 'frame'
                  ? wifiBaseFirmwareReady
                    ? '重新生成 Wi-Fi 基础固件'
                    : '生成 Wi-Fi 基础固件'
                  : '生成固件'
            }}
          </button>

          <esp-web-install-button v-if="manifestUrl" :manifest="manifestUrl">
            <button
              slot="activate"
              type="button"
              class="h-control w-full rounded-panel bg-accent px-3 text-xs font-medium text-white"
            >
              2. 连接设备并烧录
            </button>
          </esp-web-install-button>
          <button
            v-else
            type="button"
            class="h-control w-full cursor-not-allowed rounded-panel border border-transparent bg-panel-field px-3 text-xs text-muted opacity-60"
            disabled
          >
            2. 连接设备并烧录
          </button>
        </div>

        <p class="mt-panel text-[10px] leading-relaxed text-muted">
          生成固件只会在本机构建产物；第二步才会打开串口并把固件写入设备。
        </p>
        <a
          v-if="manifestUrl"
          class="mt-1 block truncate text-[10px] text-accent hover:underline"
          :href="manifestUrl"
          target="_blank"
          rel="noreferrer"
        >
          查看烧录清单
        </a>
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
