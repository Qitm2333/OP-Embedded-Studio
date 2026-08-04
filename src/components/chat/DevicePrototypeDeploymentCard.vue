<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed, ref } from 'vue'

import {
  cancelDevicePrototypeProposalFromChat,
  confirmDevicePrototypeProposalFromChat,
  executeDevicePrototypeDeploymentFromChat,
  getDevicePrototypeDeploymentPlan,
  getDevicePrototypeProposal
} from '@/app/ai/device/prototype'
import { describeDeviceDeploymentProblem } from '@/app/ai/device/errors'
import { useAIChat } from '@/app/ai/chat/use'
import { useDeploymentCardDisclosure } from '@/components/chat/useDeploymentCardDisclosure'
import { DEVICE_PROTOTYPE_EVENTS } from '@/features/device-prototype'

const { proposalId } = defineProps<{ proposalId: string }>()
const { activeTab } = useAIChat()
const pending = ref(false)
const proposal = computed(() => getDevicePrototypeProposal(proposalId))
const deployment = computed(() => getDevicePrototypeDeploymentPlan(proposalId))
const problem = computed(() => {
  const message = deployment.value?.error || proposal.value?.error
  if (!message && deployment.value?.status !== 'stale') return null
  return describeDeviceDeploymentProblem(
    message || deployment.value?.message || '交互烧录计划已过期'
  )
})

const busy = computed(() => {
  const status = deployment.value?.status
  return (
    pending.value ||
    proposal.value?.status === 'preparing' ||
    status === 'selecting-device' ||
    status === 'checking-firmware' ||
    status === 'flashing-firmware' ||
    status === 'reconnecting' ||
    status === 'transferring-content'
  )
})

const cardStatus = computed(() => {
  if (
    deployment.value?.status === 'success' ||
    deployment.value?.status === 'cancelled' ||
    deployment.value?.status === 'superseded' ||
    proposal.value?.status === 'cancelled' ||
    proposal.value?.status === 'superseded'
  ) {
    return 'terminal'
  }
  if (busy.value) return 'active'
  if (problem.value || proposal.value?.status === 'error') return 'error'
  return 'ready'
})
const { open } = useDeploymentCardDisclosure(cardStatus)

const statusLabel = computed(() => {
  if (deployment.value?.status === 'success') return '烧录成功'
  if (deployment.value?.status === 'cancelled') return '已取消'
  if (deployment.value?.status === 'superseded') return '已被替代'
  if (proposal.value?.status === 'cancelled') return '已取消'
  if (proposal.value?.status === 'superseded') return '已被替代'
  if (deployment.value?.status === 'awaiting-firmware-confirmation') return '需要初始化固件'
  if (problem.value || proposal.value?.status === 'error') return '需要处理'
  if (busy.value) return '处理中'
  return deployment.value ? '待烧录' : '待创建'
})

const statusClass = computed(() => {
  if (deployment.value?.status === 'success') return 'border-green-400/40 text-green-300'
  if (
    deployment.value?.status === 'cancelled' ||
    deployment.value?.status === 'superseded' ||
    proposal.value?.status === 'cancelled' ||
    proposal.value?.status === 'superseded'
  ) {
    return 'border-border text-muted'
  }
  if (deployment.value?.status === 'awaiting-firmware-confirmation') {
    return 'border-amber-400/40 text-amber-300'
  }
  if (problem.value || proposal.value?.status === 'error') {
    return 'border-red-400/40 text-red-300'
  }
  return 'border-border text-muted'
})

const shouldPrepare = computed(
  () =>
    !deployment.value ||
    deployment.value.status === 'stale' ||
    deployment.value.status === 'cancelled' ||
    deployment.value.status === 'superseded' ||
    problem.value?.recovery === 'reprepare'
)

const primaryLabel = computed(() => {
  if (problem.value) return problem.value.retryLabel
  if (shouldPrepare.value) {
    return proposal.value?.interactionId ? '重新准备烧录' : '创建交互并准备烧录'
  }
  return deployment.value?.needsDeviceSelection ? '确认并选择设备' : '确认并烧录'
})
const modeLabel = computed(() => {
  if (proposal.value?.mode === 'slideshow') return '幻灯片'
  if (proposal.value?.mode === 'manual') return '手动浏览'
  return '自定义交互'
})

function stateName(stateId: string): string {
  return proposal.value?.definition.states.find((state) => state.id === stateId)?.name ?? stateId
}

function eventName(eventId: string): string {
  return DEVICE_PROTOTYPE_EVENTS.find((event) => event.id === eventId)?.label ?? eventId
}

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

async function prepare(): Promise<void> {
  if (busy.value) return
  pending.value = true
  try {
    await confirmDevicePrototypeProposalFromChat(proposalId)
  } finally {
    pending.value = false
  }
}

async function execute(): Promise<void> {
  if (!deployment.value || busy.value) return
  if (deployment.value.status === 'stale') {
    await prepare()
    return
  }
  pending.value = true
  try {
    await executeDevicePrototypeDeploymentFromChat(
      proposalId,
      deployment.value.status === 'awaiting-firmware-confirmation'
    )
  } finally {
    pending.value = false
  }
}

async function handlePrimaryAction(): Promise<void> {
  if (shouldPrepare.value) await prepare()
  else await execute()
}

function cancel(): void {
  if (busy.value) return
  cancelDevicePrototypeProposalFromChat(proposalId)
}
</script>

<template>
  <CollapsibleRoot
    v-if="proposal"
    v-model:open="open"
    data-test-id="usb-prototype-deployment-card"
    class="overflow-hidden rounded-md border border-border bg-canvas"
  >
    <CollapsibleTrigger
      data-test-id="usb-prototype-deployment-card-toggle"
      class="group flex w-full items-center gap-2 px-3 py-2 text-left"
      :class="open ? 'border-b border-border' : ''"
    >
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded bg-accent/10 text-accent"
      >
        <icon-lucide-circle-check
          v-if="deployment?.status === 'success'"
          class="size-4 text-green-400"
        />
        <icon-lucide-play v-else-if="proposal.mode === 'slideshow'" class="size-4" />
        <icon-lucide-git-branch v-else class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-surface">{{ proposal.name }}</p>
        <p class="truncate text-[11px] text-muted">
          {{ modeLabel }} · {{ proposal.definition.states.length }} 个画面 ·
          {{ proposal.profileName }}
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
      <div class="space-y-2 p-3 text-[11px] leading-4">
        <div class="grid grid-cols-[52px_minmax(0,1fr)] gap-y-1">
          <span class="text-muted">初始界面</span>
          <span class="truncate text-surface">{{
            stateName(proposal.definition.initialStateId)
          }}</span>
          <span class="text-muted">界面</span>
          <span class="truncate text-surface">
            {{ proposal.definition.states.map((state) => state.name).join('、') }}
          </span>
          <template v-if="proposal.mode === 'slideshow'">
            <span class="text-muted">播放间隔</span>
            <span class="text-surface">
              每 {{ (proposal.slideshow.intervalMs / 1000).toFixed(1) }} 秒
            </span>
          </template>
          <span class="text-muted">分辨率</span>
          <span class="text-surface">
            {{ proposal.resolution.width }} × {{ proposal.resolution.height }}
            {{ proposal.roundScreen ? '· 圆形' : '' }}
          </span>
          <template v-if="deployment">
            <span class="text-muted">数据</span>
            <span class="text-surface">{{ formatBytes(deployment.contentBytes) }}</span>
          </template>
        </div>

        <details v-if="proposal.definition.transitions.length" class="border-t border-border pt-2">
          <summary class="cursor-pointer text-muted">
            {{ proposal.definition.transitions.length }} 条事件跳转
          </summary>
          <div class="mt-1.5 grid gap-1">
            <p
              v-for="transition in proposal.definition.transitions"
              :key="`${transition.fromStateId}:${transition.event}`"
              class="truncate text-surface"
            >
              {{ stateName(transition.fromStateId) }} · {{ eventName(transition.event) }} →
              {{ stateName(transition.toStateId) }}
            </p>
          </div>
        </details>
      </div>

      <div v-if="deployment" class="border-t border-border px-3 py-2.5">
        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="flex items-center gap-1.5">
            <icon-lucide-loader-circle
              v-if="deployment.firmwareStage === 'running'"
              class="size-3 animate-spin text-accent"
            />
            <icon-lucide-circle-check
              v-else-if="
                deployment.firmwareStage === 'done' || deployment.firmwareStage === 'skipped'
              "
              class="size-3 text-green-400"
            />
            <icon-lucide-circle-x
              v-else-if="deployment.firmwareStage === 'error'"
              class="size-3 text-red-400"
            />
            <icon-lucide-circle v-else class="size-3 text-muted" />
            <span class="text-surface">基础固件</span>
            <span class="text-muted">{{ stageLabel(deployment.firmwareStage) }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <icon-lucide-loader-circle
              v-if="deployment.contentStage === 'running'"
              class="size-3 animate-spin text-accent"
            />
            <icon-lucide-circle-check
              v-else-if="deployment.contentStage === 'done'"
              class="size-3 text-green-400"
            />
            <icon-lucide-circle-x
              v-else-if="deployment.contentStage === 'error'"
              class="size-3 text-red-400"
            />
            <icon-lucide-circle v-else class="size-3 text-muted" />
            <span class="text-surface">交互内容</span>
            <span class="text-muted">{{ stageLabel(deployment.contentStage) }}</span>
          </div>
        </div>
        <div v-if="busy" class="mt-2 h-1.5 overflow-hidden rounded bg-input">
          <div
            class="h-full rounded bg-accent transition-[width]"
            :style="{ width: `${Math.max(3, deployment.progress)}%` }"
          />
        </div>
      </div>

      <div v-if="problem" class="border-t border-border px-3 py-2.5 text-[11px] leading-4">
        <div
          class="border-l-2 px-2.5 py-2"
          :class="
            deployment?.status === 'awaiting-firmware-confirmation'
              ? 'border-amber-400 bg-amber-400/5'
              : 'border-red-400 bg-red-400/5'
          "
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
      </div>
      <p v-else class="border-t border-border px-3 py-2 text-[11px] leading-4 text-muted">
        {{ deployment?.message || proposal.message }}
      </p>

      <div
        v-if="
          proposal.status !== 'cancelled' &&
          proposal.status !== 'superseded' &&
          deployment?.status !== 'cancelled' &&
          deployment?.status !== 'superseded' &&
          deployment?.status !== 'success'
        "
        class="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2"
      >
        <button
          v-if="proposal.interactionId"
          type="button"
          class="mr-auto min-h-7 rounded px-2 py-1 text-xs leading-4 text-muted hover:bg-hover hover:text-surface"
          @click="activeTab = 'prototype'"
        >
          在交互栏编辑
        </button>
        <button
          type="button"
          class="h-7 rounded px-2.5 text-xs text-muted hover:bg-hover hover:text-surface disabled:opacity-40"
          :disabled="busy"
          @click="cancel"
        >
          取消
        </button>
        <button
          type="button"
          class="flex min-h-7 max-w-full items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs leading-4 font-medium text-white disabled:opacity-40"
          :disabled="busy"
          @click="handlePrimaryAction"
        >
          <icon-lucide-loader-circle v-if="busy" class="size-3 animate-spin" />
          <icon-lucide-refresh-cw
            v-else-if="shouldPrepare && proposal.interactionId"
            class="size-3 shrink-0"
          />
          <icon-lucide-git-branch v-else-if="shouldPrepare" class="size-3 shrink-0" />
          <icon-lucide-usb v-else class="size-3 shrink-0" />
          <span class="min-w-0 text-center">{{ primaryLabel }}</span>
        </button>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>
</template>
