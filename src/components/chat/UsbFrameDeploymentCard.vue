<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import {
  cancelUsbFrameDeploymentFromChat,
  executeUsbFrameDeploymentFromChat,
  updateUsbFrameDeploymentAdaptationFromChat
} from '@/app/ai/device/deployment'
import { describeDeviceDeploymentProblem } from '@/app/ai/device/errors'
import { useAIChat } from '@/app/ai/chat/use'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useDeploymentCardDisclosure } from '@/components/chat/useDeploymentCardDisclosure'
import {
  EmbeddedDisplayContentPreview,
  embeddedImagePlacementLabel,
  getUsbFrameDeploymentPlan,
  type EmbeddedImagePlacement
} from '@/features/embedded-display'

const { planId } = defineProps<{ planId: string }>()
const { submitLocalDeviceAction } = useAIChat()
const pendingAction = ref(false)
const adaptationPending = ref(false)
const adaptationError = ref('')
const plan = computed(() => getUsbFrameDeploymentPlan(planId))
const imagePlacementOptions: Array<{ value: EmbeddedImagePlacement; label: string }> = [
  { value: 'stretch', label: '拉伸' },
  { value: 'contain', label: '等比缩放' },
  { value: 'pixel-perfect', label: '不缩放' }
]

const busy = computed(() => {
  const status = plan.value?.status
  return (
    pendingAction.value ||
    status === 'selecting-device' ||
    status === 'checking-firmware' ||
    status === 'flashing-firmware' ||
    status === 'reconnecting' ||
    status === 'transferring-content'
  )
})

const canCancel = computed(
  () =>
    !busy.value &&
    !adaptationPending.value &&
    plan.value?.status !== 'success' &&
    plan.value?.status !== 'cancelled'
)
const adaptationLocked = computed(() => {
  const status = plan.value?.status
  return (
    busy.value ||
    adaptationPending.value ||
    status === 'success' ||
    status === 'cancelled' ||
    status === 'superseded' ||
    status === 'stale'
  )
})
const placementOptions = computed(() =>
  imagePlacementOptions.map((option) => ({ ...option, disabled: adaptationLocked.value }))
)

const problem = computed(() => {
  const current = plan.value
  if (!current) return null
  if (current.status !== 'error' && current.status !== 'stale') {
    return null
  }
  return describeDeviceDeploymentProblem(current.error || current.message)
})

const cardStatus = computed(() => {
  const status = plan.value?.status
  if (status === 'success' || status === 'cancelled' || status === 'superseded') return 'terminal'
  if (busy.value) return 'active'
  if (status === 'error' || status === 'stale') return 'error'
  return 'ready'
})
const { open } = useDeploymentCardDisclosure(cardStatus)

const statusLabel = computed(() => {
  const status = plan.value?.status
  if (status === 'success') return '烧录成功'
  if (status === 'cancelled') return '已取消'
  if (status === 'superseded') return '已被替代'
  if (status === 'stale') return '内容已变化'
  if (status === 'error') return '需要处理'
  if (adaptationPending.value) return '更新适配中'
  if (busy.value) return '烧录中'
  return '待确认'
})

const statusClass = computed(() => {
  const status = plan.value?.status
  if (status === 'success') return 'border-green-400/40 text-green-300'
  if (status === 'cancelled' || status === 'superseded') return 'border-border text-muted'
  if (status === 'error' || status === 'stale') return 'border-red-400/40 text-red-300'
  return 'border-border text-muted'
})

const needsReprepare = computed(
  () => plan.value?.status === 'stale' || problem.value?.recovery === 'reprepare'
)

const executeLabel = computed(() => {
  if (problem.value) return problem.value.retryLabel
  return plan.value?.needsDeviceSelection ? '确认并选择设备' : '确认并部署'
})

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

function stageLabel(status: string): string {
  if (status === 'running') return '进行中'
  if (status === 'done') return '完成'
  if (status === 'skipped') return '已验证'
  if (status === 'error') return '失败'
  return '等待'
}

async function updateAdaptation(
  placement: EmbeddedImagePlacement,
  backgroundColor?: string
): Promise<void> {
  if (!plan.value || adaptationLocked.value) return
  adaptationPending.value = true
  adaptationError.value = ''
  try {
    const updated = await updateUsbFrameDeploymentAdaptationFromChat(
      planId,
      placement,
      backgroundColor
    )
    if (!updated) adaptationError.value = '当前烧录状态无法修改画面适配'
  } catch (error) {
    adaptationError.value = error instanceof Error ? error.message : String(error)
  } finally {
    adaptationPending.value = false
  }
}

async function updatePlacement(value: string): Promise<void> {
  const placement = imagePlacementOptions.find((option) => option.value === value)?.value
  if (placement) await updateAdaptation(placement)
}

async function updateBackgroundColor(event: Event): Promise<void> {
  const backgroundColor = (event.target as HTMLInputElement).value
  if (plan.value) await updateAdaptation(plan.value.placement, backgroundColor)
}

async function execute(): Promise<void> {
  if (!plan.value || busy.value) return
  pendingAction.value = true
  try {
    await executeUsbFrameDeploymentFromChat(planId)
  } finally {
    pendingAction.value = false
  }
}

async function reprepare(): Promise<void> {
  const current = plan.value
  if (!current || pendingAction.value) return
  pendingAction.value = true
  try {
    await submitLocalDeviceAction(`重新准备并烧录“${current.frame.name}”`)
  } finally {
    pendingAction.value = false
  }
}

async function handlePrimaryAction(): Promise<void> {
  if (needsReprepare.value) await reprepare()
  else await execute()
}

function cancel(): void {
  if (!canCancel.value) return
  cancelUsbFrameDeploymentFromChat(planId)
}
</script>

<template>
  <CollapsibleRoot
    v-if="plan"
    v-model:open="open"
    data-test-id="usb-frame-deployment-card"
    class="overflow-hidden rounded-md border border-border bg-canvas"
  >
    <CollapsibleTrigger
      data-test-id="usb-frame-deployment-card-toggle"
      class="group flex w-full items-center gap-2 px-3 py-2 text-left"
      :class="open ? 'border-b border-border' : ''"
    >
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded bg-accent/10 text-accent"
      >
        <icon-lucide-circle-check v-if="plan.status === 'success'" class="size-4 text-green-400" />
        <icon-lucide-usb v-else class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-surface">USB 单画面烧录</p>
        <p class="truncate text-[11px] text-muted">
          {{ plan.frame.name }} · {{ plan.profileName }}
        </p>
      </div>
      <span class="shrink-0 rounded border px-1.5 py-0.5 text-[10px]" :class="statusClass">
        {{ statusLabel }}
      </span>
      <icon-lucide-chevron-down
        class="size-3.5 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>

    <CollapsibleContent>
      <div class="flex gap-3 p-3">
        <EmbeddedDisplayContentPreview
          :src="plan.previewUrl"
          :alt="plan.frame.name"
          :placement="plan.placement"
          :background-color="plan.backgroundColor"
          :target-width="plan.resolution.width"
          :target-height="plan.resolution.height"
          :source-width="plan.frame.width"
          :source-height="plan.frame.height"
          :round="plan.roundScreen"
          class="w-20"
        />
        <div class="min-w-0 flex-1 space-y-1 text-[11px] leading-4">
          <div class="flex gap-2">
            <span class="w-10 shrink-0 text-muted">内容</span>
            <span class="truncate text-surface">{{ plan.frame.name }}</span>
          </div>
          <div class="flex gap-2">
            <span class="w-10 shrink-0 text-muted">屏幕</span>
            <span class="text-surface">
              {{ plan.resolution.width }} × {{ plan.resolution.height }}
              {{ plan.roundScreen ? '· 圆形' : '' }}
            </span>
          </div>
          <div class="flex gap-2">
            <span class="w-10 shrink-0 text-muted">版本</span>
            <span class="text-surface">revision {{ plan.frame.revision }}</span>
          </div>
          <div class="flex gap-2">
            <span class="w-10 shrink-0 text-muted">数据</span>
            <span class="text-surface">{{ formatBytes(plan.contentBytes) }}</span>
          </div>
        </div>
      </div>

      <div class="border-t border-border px-3 py-2.5">
        <div class="mb-2 flex items-center justify-between gap-2 text-[11px]">
          <span class="font-medium text-surface">画面适配</span>
          <label class="flex items-center gap-1.5 text-muted">
            <span>{{ embeddedImagePlacementLabel(plan.placement) }}</span>
            <input
              :value="plan.backgroundColor"
              type="color"
              aria-label="烧录背景颜色"
              class="h-6 w-8 cursor-pointer rounded border border-border bg-canvas p-0.5 disabled:cursor-default disabled:opacity-50"
              :disabled="adaptationLocked"
              @change="updateBackgroundColor"
            />
          </label>
        </div>
        <SegmentedControl
          :model-value="plan.placement"
          class="w-full"
          :options="placementOptions"
          label="选择烧录画面适配方式"
          @change="updatePlacement"
        >
          <template #option="{ option }">
            <span class="flex min-w-0 items-center justify-center gap-1">
              <icon-lucide-expand v-if="option.value === 'stretch'" class="size-3 shrink-0" />
              <icon-lucide-maximize-2
                v-else-if="option.value === 'contain'"
                class="size-3 shrink-0"
              />
              <icon-lucide-scan-line v-else class="size-3 shrink-0" />
              <span class="truncate">{{ option.label }}</span>
            </span>
          </template>
        </SegmentedControl>
        <p v-if="adaptationError" class="mt-1.5 text-[10px] leading-4 text-red-300">
          {{ adaptationError }}
        </p>
      </div>

      <div class="border-t border-border px-3 py-2.5">
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="flex items-center gap-1.5">
            <icon-lucide-loader-circle
              v-if="plan.firmwareStage === 'running'"
              class="size-3 animate-spin text-accent"
            />
            <icon-lucide-circle-check
              v-else-if="plan.firmwareStage === 'done' || plan.firmwareStage === 'skipped'"
              class="size-3 text-green-400"
            />
            <icon-lucide-circle-x
              v-else-if="plan.firmwareStage === 'error'"
              class="size-3 text-red-400"
            />
            <icon-lucide-circle v-else class="size-3 text-muted" />
            <span class="text-surface">基础固件</span>
            <span class="text-muted">{{ stageLabel(plan.firmwareStage) }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <icon-lucide-loader-circle
              v-if="plan.contentStage === 'running'"
              class="size-3 animate-spin text-accent"
            />
            <icon-lucide-circle-check
              v-else-if="plan.contentStage === 'done'"
              class="size-3 text-green-400"
            />
            <icon-lucide-circle-x
              v-else-if="plan.contentStage === 'error'"
              class="size-3 text-red-400"
            />
            <icon-lucide-circle v-else class="size-3 text-muted" />
            <span class="text-surface">画面内容</span>
            <span class="text-muted">{{ stageLabel(plan.contentStage) }}</span>
          </div>
        </div>

        <div v-if="busy" class="mt-2 h-1.5 overflow-hidden rounded bg-input">
          <div
            class="h-full rounded bg-accent transition-[width]"
            :style="{ width: `${Math.max(3, plan.progress)}%` }"
          />
        </div>
        <div
          v-if="problem"
          class="mt-2 border-l-2 border-red-400 bg-red-400/5 px-2.5 py-2 text-[11px] leading-4"
        >
          <p class="font-medium text-surface">{{ problem.title }}</p>
          <p class="mt-0.5 text-muted">原因：{{ problem.cause }}</p>
          <p class="mt-0.5 text-surface">下一步：{{ problem.action }}</p>
          <details
            v-if="problem.detail && problem.detail !== problem.cause"
            class="mt-1 text-muted"
          >
            <summary class="cursor-pointer">技术细节</summary>
            <p class="mt-0.5 break-words">{{ problem.detail }}</p>
          </details>
        </div>
        <p v-else class="mt-2 text-[11px] leading-4 text-muted">{{ plan.message }}</p>
        <p
          v-if="plan.firstDeployment && plan.status === 'ready'"
          class="mt-1 text-[10px] text-amber-300"
        >
          将先检查 OPUSB/1；不兼容时会擦除并初始化基础固件，然后写入内容。
        </p>
      </div>

      <details v-if="plan.logs.length" class="border-t border-border px-3 py-2">
        <summary class="cursor-pointer text-[10px] text-muted">执行日志</summary>
        <pre
          class="scrollbar-thin mt-2 max-h-28 overflow-auto text-[10px] whitespace-pre-wrap text-muted"
          >{{ plan.logs.join('\n') }}</pre
        >
      </details>

      <div
        v-if="
          plan.status !== 'success' && plan.status !== 'cancelled' && plan.status !== 'superseded'
        "
        class="flex flex-wrap justify-end gap-2 border-t border-border px-3 py-2"
      >
        <button
          type="button"
          class="h-7 rounded px-2.5 text-xs text-muted hover:bg-hover hover:text-surface disabled:opacity-40"
          :disabled="!canCancel"
          @click="cancel"
        >
          取消
        </button>
        <button
          type="button"
          class="flex min-h-7 max-w-full items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs leading-4 font-medium text-white hover:brightness-110 disabled:opacity-40"
          :disabled="busy || adaptationPending"
          @click="handlePrimaryAction"
        >
          <icon-lucide-loader-circle
            v-if="busy || adaptationPending"
            class="size-3 animate-spin"
          />
          <icon-lucide-refresh-cw v-else-if="needsReprepare" class="size-3 shrink-0" />
          <icon-lucide-usb v-else class="size-3 shrink-0" />
          <span class="min-w-0 text-center">{{ executeLabel }}</span>
        </button>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
