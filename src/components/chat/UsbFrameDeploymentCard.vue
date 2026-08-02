<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  cancelUsbFrameDeploymentFromChat,
  executeUsbFrameDeploymentFromChat
} from '@/app/ai/device/deployment'
import { useAIChat } from '@/app/ai/chat/use'
import { getUsbFrameDeploymentPlan } from '@/features/embedded-display'

const { planId } = defineProps<{ planId: string }>()
const { appendLocalDeviceResult } = useAIChat()
const pendingAction = ref(false)
let executionAttempt = 0
const plan = computed(() => getUsbFrameDeploymentPlan(planId))

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
  () => !busy.value && plan.value?.status !== 'success' && plan.value?.status !== 'cancelled'
)

const executeLabel = computed(() => {
  const status = plan.value?.status
  if (status === 'awaiting-firmware-confirmation') return '重新初始化并继续'
  if (status === 'error') return '重新执行'
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

async function execute(): Promise<void> {
  if (!plan.value || busy.value) return
  const authorize = plan.value.status === 'awaiting-firmware-confirmation'
  executionAttempt += 1
  pendingAction.value = true
  try {
    await executeUsbFrameDeploymentFromChat(planId, authorize)
    const result = plan.value
    if (result?.status === 'success') {
      appendLocalDeviceResult(
        `烧录完成，已将“${result.frame.name}”写入 ${result.profileName}。`,
        `${planId}:success`
      )
    } else if (result?.status === 'error' || result?.status === 'stale') {
      appendLocalDeviceResult(
        `烧录未完成：${result.message}`,
        `${planId}:${result.status}:${executionAttempt}`
      )
    }
  } finally {
    pendingAction.value = false
  }
}

function cancel(): void {
  if (!canCancel.value) return
  cancelUsbFrameDeploymentFromChat(planId)
}
</script>

<template>
  <div
    v-if="plan"
    data-test-id="usb-frame-deployment-card"
    class="overflow-hidden rounded-md border border-border bg-canvas"
  >
    <div class="flex items-center gap-2 border-b border-border px-3 py-2">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded bg-accent/10 text-accent"
      >
        <icon-lucide-usb class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-surface">USB 单 Frame 部署</p>
        <p class="truncate text-[11px] text-muted">{{ plan.profileName }}</p>
      </div>
      <span
        class="shrink-0 rounded border px-1.5 py-0.5 text-[10px]"
        :class="
          plan.firstDeployment ? 'border-amber-400/40 text-amber-300' : 'border-border text-muted'
        "
      >
        {{ plan.firstDeployment ? '首次部署' : '内容更新' }}
      </span>
    </div>

    <div class="flex gap-3 p-3">
      <img
        :src="plan.previewUrl"
        :alt="plan.frame.name"
        class="size-20 shrink-0 rounded border border-border bg-black object-contain"
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
          <span class="text-surface">Frame 内容</span>
          <span class="text-muted">{{ stageLabel(plan.contentStage) }}</span>
        </div>
      </div>

      <div v-if="busy" class="mt-2 h-1.5 overflow-hidden rounded bg-input">
        <div
          class="h-full rounded bg-accent transition-[width]"
          :style="{ width: `${Math.max(3, plan.progress)}%` }"
        />
      </div>
      <p
        class="mt-2 text-[11px] leading-4"
        :class="plan.status === 'error' ? 'text-red-400' : 'text-muted'"
      >
        {{ plan.message }}
      </p>
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
      v-if="plan.status !== 'success' && plan.status !== 'cancelled' && plan.status !== 'stale'"
      class="flex justify-end gap-2 border-t border-border px-3 py-2"
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
        class="flex h-7 items-center gap-1.5 rounded bg-accent px-3 text-xs font-medium text-white hover:brightness-110 disabled:opacity-40"
        :disabled="busy"
        @click="execute"
      >
        <icon-lucide-loader-circle v-if="busy" class="size-3 animate-spin" />
        <icon-lucide-usb v-else class="size-3" />
        {{ executeLabel }}
      </button>
    </div>
  </div>
</template>
