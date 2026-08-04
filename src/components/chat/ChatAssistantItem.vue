<script setup lang="ts">
import { getToolName, isFileUIPart, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { Markdown } from 'vue-stream-markdown'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from '@open-pencil/vue'
import 'vue-stream-markdown/index.css'

import { describeAIError } from '@/app/ai/chat/errors'
import { isLeakedToolProtocol } from '@/app/ai/chat/protocol'
import { describeDeviceDeploymentProblem } from '@/app/ai/device/errors'
import UsbFrameDeploymentCard from '@/components/chat/UsbFrameDeploymentCard.vue'
import DevicePrototypeDeploymentCard from '@/components/chat/DevicePrototypeDeploymentCard.vue'

import type { UIDataTypes, UIMessagePart, UITools } from 'ai'

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>

type DisplayItem =
  | { kind: 'part'; key: string; part: UIMessagePart<UIDataTypes, UITools> }
  | { kind: 'tool-group'; key: string; parts: ToolPart[] }

type ProgressDetails = {
  observation: string
  nextAction: string
  reason: string
}

type ReferenceDetails = {
  summary: string
  mustPreserve: string[]
}

type RenderDesignDetails = {
  phase: string
  observation: string
  intent: string
  changes: string[]
}

const { item, summary = false } = defineProps<{ item: DisplayItem; summary?: boolean }>()
const { dialogs } = useI18n()
const reasoningContent = ref<HTMLElement | null>(null)
const followsReasoningBottom = ref(true)

watch(
  () => item.key,
  () => {
    followsReasoningBottom.value = true
  }
)

watch(
  () =>
    item.kind === 'part' && isReasoningUIPart(item.part) && item.part.state === 'streaming'
      ? item.part.text
      : null,
  async (text) => {
    if (text === null || !followsReasoningBottom.value) return
    await nextTick()
    const element = reasoningContent.value
    if (element) element.scrollTop = element.scrollHeight
  },
  { flush: 'post' }
)

function updateReasoningFollowState(event: Event): void {
  const element = event.currentTarget as HTMLElement
  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
  followsReasoningBottom.value = distanceFromBottom <= 24
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toolInput(part: ToolPart): Record<string, unknown> | null {
  return 'input' in part && isRecord(part.input) ? part.input : null
}

function progressDetails(part: ToolPart): ProgressDetails | null {
  if (getToolName(part) !== 'report_progress') return null
  const input = toolInput(part)
  if (
    !input ||
    typeof input.observation !== 'string' ||
    typeof input.nextAction !== 'string' ||
    typeof input.reason !== 'string'
  ) {
    return null
  }
  return {
    observation: input.observation,
    nextAction: input.nextAction,
    reason: input.reason
  }
}

function referenceDetails(part: ToolPart): ReferenceDetails | null {
  if (getToolName(part) !== 'record_reference_analysis') return null
  const input = toolInput(part)
  if (!input || typeof input.summary !== 'string' || !Array.isArray(input.mustPreserve)) {
    return null
  }
  return {
    summary: input.summary,
    mustPreserve: input.mustPreserve.filter((value): value is string => typeof value === 'string')
  }
}

function renderDesignDetails(part: ToolPart): RenderDesignDetails | null {
  if (getToolName(part) !== 'render_design') return null
  const input = toolInput(part)
  if (
    !input ||
    typeof input.phase !== 'string' ||
    typeof input.observation !== 'string' ||
    typeof input.intent !== 'string' ||
    !Array.isArray(input.changes)
  ) {
    return null
  }
  return {
    phase: input.phase,
    observation: input.observation,
    intent: input.intent,
    changes: input.changes.filter((value): value is string => typeof value === 'string')
  }
}

function isCodeRender(part: ToolPart): boolean {
  return getToolName(part) === 'render'
}

function codeRenderTitle(part: ToolPart): string {
  if (toolState(part) === 'pending') return 'Generating interface'
  if (toolState(part) === 'error') return 'Design code failed'
  if (part.state === 'output-available' && isRecord(part.output)) {
    const name = part.output.name
    if (typeof name === 'string' && name.trim()) return `Updated ${name}`
  }
  return 'Design updated'
}

function deploymentPlanId(part: ToolPart): string | null {
  if (getToolName(part) !== 'prepare_usb_frame_deployment' || part.state !== 'output-available') {
    return null
  }
  if (!isRecord(part.output) || part.output.kind !== 'usb-frame-deployment-plan') return null
  return typeof part.output.planId === 'string' ? part.output.planId : null
}

function prototypeProposalId(part: ToolPart): string | null {
  if (
    getToolName(part) !== 'prepare_usb_prototype_deployment' ||
    part.state !== 'output-available'
  ) {
    return null
  }
  if (!isRecord(part.output) || part.output.kind !== 'usb-prototype-deployment-proposal') {
    return null
  }
  return typeof part.output.proposalId === 'string' ? part.output.proposalId : null
}

function toolDisplayName(part: ToolPart): string {
  return getToolName(part)
    .replace(/^mcp__[^_]+__/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function hasErrorOutput(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    typeof part.output === 'object' &&
    part.output !== null &&
    'error' in part.output
  )
}

function toolState(part: ToolPart): 'pending' | 'done' | 'error' {
  if (part.state === 'output-error' || hasErrorOutput(part)) return 'error'
  if (part.state === 'output-available') return 'done'
  return 'pending'
}

function toolImage(part: ToolPart): { url: string; mediaType: string } | null {
  if (part.state !== 'output-available' || !part.output || typeof part.output !== 'object') {
    return null
  }
  if (!('base64' in part.output) || !('mimeType' in part.output)) return null
  const { base64, mimeType } = part.output as { base64: unknown; mimeType: unknown }
  if (
    typeof base64 !== 'string' ||
    typeof mimeType !== 'string' ||
    !mimeType.startsWith('image/')
  ) {
    return null
  }
  return { url: `data:${mimeType};base64,${base64}`, mediaType: mimeType }
}

function formatToolError(part: ToolPart): string {
  let error = 'Tool failed'
  if (part.state === 'output-error' && part.errorText) {
    error = part.errorText
  } else if (hasErrorOutput(part)) {
    error = String((part.output as { error: unknown }).error)
  }
  if (getToolName(part).startsWith('prepare_usb_')) {
    const problem = describeDeviceDeploymentProblem(error)
    return `${problem.title}：${problem.action}`
  }
  return describeAIError(error).message
}

function groupState(parts: ToolPart[]): 'pending' | 'done' | 'error' {
  if (parts.some((part) => toolState(part) === 'error')) return 'error'
  if (parts.some((part) => toolState(part) === 'pending')) return 'pending'
  return 'done'
}

function groupTitle(parts: ToolPart[]): string {
  return parts.length === 1 ? toolDisplayName(parts[0]) : `${parts.length} operations`
}

function groupStatus(parts: ToolPart[]): string {
  const errors = parts.filter((part) => toolState(part) === 'error').length
  if (errors > 0) return `${errors} ${errors === 1 ? 'error' : 'errors'}`
  return groupState(parts) === 'pending' ? 'Running' : 'Done'
}
</script>

<template>
  <CollapsibleRoot
    v-if="item.kind === 'tool-group'"
    data-test-id="chat-tool-group"
    class="border-l-2 px-2 py-1"
    :class="
      groupState(item.parts) === 'error'
        ? 'border-red-500 bg-red-500/5'
        : 'border-border bg-canvas/40'
    "
  >
    <CollapsibleTrigger class="group flex h-7 w-full min-w-0 items-center gap-2 text-left">
      <icon-lucide-loader-circle
        v-if="groupState(item.parts) === 'pending'"
        class="size-3.5 shrink-0 animate-spin text-accent"
      />
      <icon-lucide-triangle-alert
        v-else-if="groupState(item.parts) === 'error'"
        class="size-3.5 shrink-0 text-red-400"
      />
      <icon-lucide-check v-else class="size-3.5 shrink-0 text-green-400" />
      <span class="min-w-0 truncate text-xs text-surface">{{ groupTitle(item.parts) }}</span>
      <span
        class="shrink-0 text-[11px]"
        :class="groupState(item.parts) === 'error' ? 'text-red-400' : 'text-muted'"
      >
        {{ groupStatus(item.parts) }}
      </span>
      <icon-lucide-chevron-down
        class="ml-auto size-3 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180"
      />
    </CollapsibleTrigger>
    <CollapsibleContent
      class="data-[state=closed]:collapsible-up data-[state=open]:collapsible-down overflow-hidden"
    >
      <div class="space-y-1 border-t border-border/60 pt-1.5 pb-1">
        <div
          v-for="part in item.parts"
          :key="part.toolCallId"
          class="flex min-w-0 items-start gap-2 text-[11px] leading-4"
        >
          <span class="shrink-0 text-muted">{{ toolDisplayName(part) }}</span>
          <span v-if="toolState(part) === 'error'" class="min-w-0 break-words text-red-400">
            {{ formatToolError(part) }}
          </span>
          <span v-else class="text-muted">{{ groupStatus([part]) }}</span>
        </div>
      </div>
    </CollapsibleContent>
  </CollapsibleRoot>

  <template v-else-if="isToolUIPart(item.part)">
    <DevicePrototypeDeploymentCard
      v-if="prototypeProposalId(item.part)"
      :proposal-id="prototypeProposalId(item.part) ?? ''"
    />

    <UsbFrameDeploymentCard
      v-else-if="deploymentPlanId(item.part)"
      :plan-id="deploymentPlanId(item.part) ?? ''"
    />

    <div
      v-else-if="isCodeRender(item.part)"
      data-test-id="chat-code-render"
      class="flex min-h-8 min-w-0 items-center gap-2 border-l-2 border-accent bg-accent/5 px-2.5 py-1.5"
    >
      <icon-lucide-loader-circle
        v-if="toolState(item.part) === 'pending'"
        class="size-3.5 shrink-0 animate-spin text-accent"
      />
      <icon-lucide-triangle-alert
        v-else-if="toolState(item.part) === 'error'"
        class="size-3.5 shrink-0 text-red-400"
      />
      <icon-lucide-code-xml v-else class="size-3.5 shrink-0 text-green-400" />
      <span class="min-w-0 truncate text-xs text-surface">{{ codeRenderTitle(item.part) }}</span>
      <span
        class="ml-auto shrink-0 text-[11px]"
        :class="toolState(item.part) === 'error' ? 'text-red-400' : 'text-muted'"
      >
        {{ groupStatus([item.part]) }}
      </span>
      <span
        v-if="toolState(item.part) === 'error'"
        class="min-w-0 truncate text-[11px] text-red-400"
      >
        {{ formatToolError(item.part) }}
      </span>
    </div>

    <div
      v-else-if="renderDesignDetails(item.part)"
      data-test-id="chat-render-design"
      class="space-y-2 border-l-2 border-accent bg-accent/5 px-3 py-2.5"
    >
      <div class="flex items-start gap-2">
        <icon-lucide-code-xml class="mt-0.5 size-4 shrink-0 text-accent" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="min-w-0 text-sm leading-5 font-medium text-surface">
              {{ renderDesignDetails(item.part)?.observation }}
            </p>
            <icon-lucide-loader-circle
              v-if="toolState(item.part) === 'pending'"
              class="size-3.5 shrink-0 animate-spin text-accent"
            />
          </div>
          <p class="mt-1 text-xs leading-4 text-muted">
            {{ renderDesignDetails(item.part)?.intent }}
          </p>
        </div>
      </div>
      <div class="space-y-1 pl-6">
        <p
          v-for="change in renderDesignDetails(item.part)?.changes"
          :key="change"
          class="flex gap-1.5 text-xs leading-4 text-surface"
        >
          <span class="text-accent">-</span>
          <span>{{ change }}</span>
        </p>
      </div>
      <p
        v-if="toolState(item.part) === 'error'"
        class="break-words pl-6 text-xs leading-4 text-red-400"
      >
        {{ formatToolError(item.part) }}
      </p>
      <img
        v-if="toolImage(item.part)"
        data-test-id="chat-tool-image"
        :src="toolImage(item.part)?.url"
        alt="Rendered design checkpoint"
        class="max-h-64 w-full rounded border border-border bg-canvas object-contain"
      />
    </div>

    <div
      v-else-if="progressDetails(item.part)"
      data-test-id="chat-progress-note"
      class="border-l-2 border-accent bg-accent/5 px-3 py-2.5"
    >
      <div class="flex items-start gap-2">
        <icon-lucide-scan-search class="mt-0.5 size-4 shrink-0 text-accent" />
        <p class="text-sm leading-5 font-medium text-surface">
          {{ progressDetails(item.part)?.observation }}
        </p>
      </div>
      <div class="mt-1.5 flex items-start gap-2 pl-0.5">
        <icon-lucide-arrow-right class="mt-0.5 size-3.5 shrink-0 text-accent" />
        <p class="text-[13px] leading-5 text-surface">
          {{ progressDetails(item.part)?.nextAction }}
        </p>
      </div>
      <p class="mt-1 pl-6 text-xs leading-4 text-muted">
        {{ progressDetails(item.part)?.reason }}
      </p>
    </div>

    <div
      v-else-if="referenceDetails(item.part)"
      data-test-id="chat-reference-analysis"
      class="border-l-2 border-sky-400 bg-sky-400/5 px-3 py-2.5"
    >
      <div class="flex items-start gap-2">
        <icon-lucide-scan-eye class="mt-0.5 size-4 shrink-0 text-sky-400" />
        <p class="text-sm leading-5 font-medium text-surface">
          {{ referenceDetails(item.part)?.summary }}
        </p>
      </div>
      <div class="mt-2 flex flex-wrap gap-1.5 pl-6">
        <span
          v-for="detail in referenceDetails(item.part)?.mustPreserve"
          :key="detail"
          class="border border-border bg-input px-1.5 py-0.5 text-[11px] leading-4 text-muted"
        >
          {{ detail }}
        </span>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div
        data-test-id="chat-tool-summary"
        class="flex h-7 min-w-0 items-center gap-2 border-l-2 border-border bg-canvas/40 px-2"
      >
        <icon-lucide-loader-circle
          v-if="toolState(item.part) === 'pending'"
          class="size-3.5 shrink-0 animate-spin text-accent"
        />
        <icon-lucide-triangle-alert
          v-else-if="toolState(item.part) === 'error'"
          class="size-3.5 shrink-0 text-red-400"
        />
        <icon-lucide-image v-else class="size-3.5 shrink-0 text-green-400" />
        <span class="min-w-0 truncate text-xs text-surface">Visual checkpoint</span>
        <span
          class="shrink-0 text-[11px]"
          :class="toolState(item.part) === 'error' ? 'text-red-400' : 'text-muted'"
        >
          {{ groupStatus([item.part]) }}
        </span>
      </div>
      <p
        v-if="toolState(item.part) === 'error'"
        class="break-words px-2 text-[11px] leading-4 text-red-400"
      >
        {{ formatToolError(item.part) }}
      </p>
      <img
        v-if="toolImage(item.part)"
        data-test-id="chat-tool-image"
        :src="toolImage(item.part)?.url"
        :alt="`${toolDisplayName(item.part)} result`"
        class="max-h-56 w-full rounded object-contain"
      />
    </div>
  </template>

  <div
    v-else-if="isReasoningUIPart(item.part) && item.part.text"
    data-test-id="chat-reasoning"
    class="min-w-0 border-l-2 border-accent/70 bg-accent/5 px-2.5 py-2"
  >
    <div class="flex h-5 min-w-0 items-center gap-2">
      <icon-lucide-loader-circle
        v-if="item.part.state === 'streaming'"
        class="size-3.5 shrink-0 animate-spin text-accent"
      />
      <icon-lucide-brain v-else class="size-3.5 shrink-0 text-muted" />
      <span class="min-w-0 truncate text-xs font-medium text-surface">
        {{ dialogs.aiProcess }}
      </span>
      <span class="ml-auto shrink-0 text-[11px] text-muted">
        {{ item.part.state === 'streaming' ? '...' : dialogs.done }}
      </span>
    </div>
    <div
      ref="reasoningContent"
      data-test-id="chat-reasoning-content"
      class="mt-1.5 max-h-48 overflow-y-auto pr-1 text-xs leading-5 whitespace-pre-wrap text-muted"
      @scroll="updateReasoningFollowState"
    >
      {{ item.part.text }}
    </div>
  </div>

  <img
    v-else-if="isFileUIPart(item.part)"
    data-test-id="chat-message-image"
    :src="item.part.url"
    :alt="item.part.filename ?? 'Generated image'"
    class="max-h-64 w-full rounded-md border border-border bg-canvas object-contain"
  />

  <div
    v-else-if="isTextUIPart(item.part) && isLeakedToolProtocol(item.part.text)"
    data-test-id="chat-tool-protocol-warning"
    class="flex min-w-0 items-start gap-2 border-l-2 border-amber-400 bg-amber-400/5 px-2.5 py-2 text-xs leading-5 text-surface"
  >
    <icon-lucide-triangle-alert class="mt-0.5 size-3.5 shrink-0 text-amber-400" />
    <span>{{ dialogs.aiToolProtocolError }}</span>
  </div>

  <div
    v-else-if="isTextUIPart(item.part) && item.part.text"
    data-test-id="chat-text-bubble"
    :data-summary="summary ? 'true' : undefined"
    :class="
      summary
        ? 'px-0.5 py-1 text-sm leading-6 text-surface'
        : 'rounded-lg rounded-tl-sm bg-hover px-3 py-2.5 text-sm leading-5 text-surface'
    "
  >
    <Markdown
      :content="item.part.text"
      :mermaid="false"
      class="chat-markdown [--foreground:var(--color-surface)]"
    />
  </div>
</template>
