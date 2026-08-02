<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  cancelDevicePrototypeProposalFromChat,
  confirmDevicePrototypeProposalFromChat,
  executeDevicePrototypeDeploymentFromChat,
  getDevicePrototypeDeploymentPlan,
  getDevicePrototypeProposal
} from '@/app/ai/device/prototype'
import { useAIChat } from '@/app/ai/chat/use'
import { DEVICE_PROTOTYPE_EVENTS } from '@/features/device-prototype'

const { proposalId } = defineProps<{ proposalId: string }>()
const { activeTab, appendLocalDeviceResult } = useAIChat()
const pending = ref(false)
let executionAttempt = 0
const proposal = computed(() => getDevicePrototypeProposal(proposalId))
const deployment = computed(() => getDevicePrototypeDeploymentPlan(proposalId))

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
  executionAttempt += 1
  try {
    await executeDevicePrototypeDeploymentFromChat(
      proposalId,
      deployment.value.status === 'awaiting-firmware-confirmation'
    )
    const result = deployment.value
    const interaction = proposal.value
    if (result?.status === 'success' && interaction) {
      appendLocalDeviceResult(
        `烧录完成，已写入“${interaction.name}”：${interaction.definition.states.length} 个界面，${interaction.definition.transitions.length} 条跳转。`,
        `${proposalId}:success`
      )
    } else if (result?.status === 'error' || result?.status === 'stale') {
      appendLocalDeviceResult(
        `交互烧录未完成：${result.message}`,
        `${proposalId}:${result.status}:${executionAttempt}`
      )
    }
  } finally {
    pending.value = false
  }
}

function cancel(): void {
  if (busy.value) return
  cancelDevicePrototypeProposalFromChat(proposalId)
}
</script>

<template>
  <div
    v-if="proposal"
    data-test-id="usb-prototype-deployment-card"
    class="overflow-hidden rounded-md border border-border bg-canvas"
  >
    <div class="flex items-center gap-2 border-b border-border px-3 py-2">
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded bg-accent/10 text-accent"
      >
        <icon-lucide-git-branch class="size-4" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-surface">{{ proposal.name }}</p>
        <p class="truncate text-[11px] text-muted">USB 交互烧录 · {{ proposal.profileName }}</p>
      </div>
      <span
        v-if="proposal.interactionId"
        class="shrink-0 rounded border border-green-400/40 px-1.5 py-0.5 text-[10px] text-green-300"
      >
        已添加到交互栏
      </span>
    </div>

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

    <p
      class="border-t border-border px-3 py-2 text-[11px] leading-4"
      :class="proposal.error || deployment?.error ? 'text-red-400' : 'text-muted'"
    >
      {{ deployment?.message || proposal.message }}
    </p>

    <div
      v-if="proposal.status !== 'cancelled' && deployment?.status !== 'success'"
      class="flex items-center justify-end gap-2 border-t border-border px-3 py-2"
    >
      <button
        v-if="proposal.interactionId"
        type="button"
        class="mr-auto h-7 rounded px-2 text-xs text-muted hover:bg-hover hover:text-surface"
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
        v-if="!deployment || deployment.status === 'stale' || deployment.status === 'cancelled'"
        type="button"
        class="flex h-7 items-center gap-1.5 rounded bg-accent px-3 text-xs font-medium text-white disabled:opacity-40"
        :disabled="busy"
        @click="prepare"
      >
        <icon-lucide-loader-circle v-if="busy" class="size-3 animate-spin" />
        <icon-lucide-git-branch v-else class="size-3" />
        {{ proposal.interactionId ? '重新准备烧录' : '创建交互并准备烧录' }}
      </button>
      <button
        v-else
        type="button"
        class="flex h-7 items-center gap-1.5 rounded bg-accent px-3 text-xs font-medium text-white disabled:opacity-40"
        :disabled="busy"
        @click="execute"
      >
        <icon-lucide-loader-circle v-if="busy" class="size-3 animate-spin" />
        <icon-lucide-usb v-else class="size-3" />
        {{
          deployment.status === 'awaiting-firmware-confirmation'
            ? '初始化固件并继续'
            : deployment.status === 'error'
              ? '重新执行'
              : '确认并烧录'
        }}
      </button>
    </div>
  </div>
</template>
