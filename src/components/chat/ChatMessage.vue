<script setup lang="ts">
import { getToolName, isFileUIPart, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n, vTestId } from '@open-pencil/vue'

import { isLeakedToolProtocol } from '@/app/ai/chat/protocol'
import ChatAssistantItem from '@/components/chat/ChatAssistantItem.vue'

import type { UIDataTypes, UIMessage, UIMessagePart, UITools } from 'ai'

const { message, active = false } = defineProps<{ message: UIMessage; active?: boolean }>()
const { dialogs } = useI18n()

type ToolPart = Extract<UIMessagePart<UIDataTypes, UITools>, { toolCallId: string }>

type DisplayItem =
  | { kind: 'part'; key: string; part: UIMessagePart<UIDataTypes, UITools> }
  | { kind: 'tool-group'; key: string; parts: ToolPart[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toolInput(part: ToolPart): Record<string, unknown> | null {
  return 'input' in part && isRecord(part.input) ? part.input : null
}

function isNarrationTool(part: ToolPart): boolean {
  const name = getToolName(part)
  if (name === 'report_progress') {
    const input = toolInput(part)
    return !!input && typeof input.observation === 'string'
  }
  if (name === 'record_reference_analysis') {
    const input = toolInput(part)
    return !!input && typeof input.summary === 'string'
  }
  if (name === 'render_design') {
    const input = toolInput(part)
    return !!input && typeof input.observation === 'string'
  }
  if (name === 'render') return true
  if (name === 'prepare_usb_frame_deployment') return true
  if (name === 'prepare_usb_prototype_deployment') return true
  if (name === 'update_usb_deployment_adaptation') return true
  return false
}

function countsAsOperation(part: ToolPart): boolean {
  const name = getToolName(part)
  return name !== 'report_progress' && name !== 'record_reference_analysis'
}

function hasErrorOutput(part: ToolPart): boolean {
  return (
    part.state === 'output-available' &&
    typeof part.output === 'object' &&
    part.output !== null &&
    'error' in part.output
  )
}

function isHiddenInternalTool(part: ToolPart): boolean {
  return (
    (getToolName(part) === 'record_visual_review' ||
      getToolName(part) === 'validate_layout' ||
      getToolName(part) === 'update_usb_deployment_adaptation') &&
    part.state === 'output-available' &&
    !hasErrorOutput(part)
  )
}

function partKey(part: UIMessagePart<UIDataTypes, UITools>, index: number): string {
  if ('toolCallId' in part) return part.toolCallId
  return `part-${index}`
}

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = []
  let groupedTools: ToolPart[] = []

  const flushTools = () => {
    if (groupedTools.length === 0) return
    items.push({
      kind: 'tool-group',
      key: `tool-group-${groupedTools[0].toolCallId}`,
      parts: groupedTools
    })
    groupedTools = []
  }

  message.parts.forEach((part, index) => {
    if (part.type === 'step-start') return
    if (isToolUIPart(part)) {
      const toolPart = part as ToolPart
      if (isHiddenInternalTool(toolPart)) return
      if (
        isNarrationTool(toolPart) ||
        getToolName(toolPart) === 'export_image' ||
        getToolName(toolPart) === 'render_design' ||
        getToolName(toolPart) === 'render'
      ) {
        flushTools()
        items.push({ kind: 'part', key: partKey(part, index), part })
      } else {
        groupedTools.push(toolPart)
      }
      return
    }
    flushTools()
    items.push({ kind: 'part', key: partKey(part, index), part })
  })
  flushTools()
  return items
})

const finalTextKey = computed(() => {
  for (let index = message.parts.length - 1; index >= 0; index--) {
    const part = message.parts[index]
    if (isTextUIPart(part) && part.text.trim() && !isLeakedToolProtocol(part.text)) {
      return partKey(part, index)
    }
  }
  return undefined
})

function renderSummaryItem(): DisplayItem | undefined {
  for (let index = message.parts.length - 1; index >= 0; index--) {
    const part = message.parts[index]
    if (!isToolUIPart(part) || getToolName(part) !== 'render') continue
    const toolPart = part as ToolPart
    if (toolPart.state !== 'output-available' || hasErrorOutput(toolPart)) return undefined
    const input = toolInput(toolPart)
    const summary = typeof input?.summary === 'string' ? input.summary.trim() : ''
    const outputName = isRecord(toolPart.output) ? toolPart.output.name : undefined
    const text =
      summary && !isLeakedToolProtocol(summary)
        ? summary
        : `Updated ${typeof outputName === 'string' ? outputName : 'the design'}. Rendering succeeded.`
    return {
      kind: 'part',
      key: `${toolPart.toolCallId}-summary`,
      part: { type: 'text', text }
    }
  }
  return undefined
}

function deploymentSummaryItem(): DisplayItem | undefined {
  for (let index = message.parts.length - 1; index >= 0; index--) {
    const part = message.parts[index]
    if (!isToolUIPart(part)) continue
    const toolPart = part as ToolPart
    if (toolPart.state !== 'output-available' || hasErrorOutput(toolPart)) continue
    const name = getToolName(toolPart)
    let text = ''
    if (name === 'prepare_usb_frame_deployment') {
      text = '部署内容已准备，请确认后执行。'
    } else if (name === 'prepare_usb_prototype_deployment') {
      text = '交互方案已准备，请确认后创建并烧录。'
    } else if (name === 'update_usb_deployment_adaptation') {
      text = '原烧录卡片的画面适配已更新。'
    }
    if (!text) continue
    return {
      kind: 'part',
      key: `${toolPart.toolCallId}-deployment-summary`,
      part: { type: 'text', text }
    }
  }
  return undefined
}

const finalItem = computed(() => {
  if (finalTextKey.value) {
    return displayItems.value.find(
      (item) => item.kind === 'part' && item.key === finalTextKey.value
    )
  }
  const renderSummary = renderSummaryItem()
  if (renderSummary) return renderSummary
  const deploymentSummary = deploymentSummaryItem()
  if (deploymentSummary) return deploymentSummary
  return [...displayItems.value]
    .reverse()
    .find(
      (item) =>
        item.kind === 'part' && isTextUIPart(item.part) && isLeakedToolProtocol(item.part.text)
    )
})

function isPersistentItem(item: DisplayItem): boolean {
  return (
    item.kind === 'part' &&
    isToolUIPart(item.part) &&
    (getToolName(item.part as ToolPart) === 'prepare_usb_frame_deployment' ||
      getToolName(item.part as ToolPart) === 'prepare_usb_prototype_deployment' ||
      getToolName(item.part as ToolPart) === 'render')
  )
}

function isDeploymentItem(item: DisplayItem): boolean {
  if (item.kind !== 'part' || !isToolUIPart(item.part)) return false
  const name = getToolName(item.part as ToolPart)
  return name === 'prepare_usb_frame_deployment' || name === 'prepare_usb_prototype_deployment'
}

const persistentItems = computed(() => displayItems.value.filter(isPersistentItem))

const leadingPersistentItems = computed(() =>
  persistentItems.value.filter((item) => !isDeploymentItem(item))
)

const deploymentItems = computed(() => displayItems.value.filter(isDeploymentItem))

const nonDeploymentItems = computed(() =>
  displayItems.value.filter((item) => !isDeploymentItem(item))
)

const finalItemIsSynthetic = computed(() =>
  Boolean(finalItem.value && !displayItems.value.some((item) => item.key === finalItem.value?.key))
)

const responsePartsComplete = computed(() =>
  message.parts.every((part) => {
    if (isTextUIPart(part) || isReasoningUIPart(part)) return part.state !== 'streaming'
    if (!isToolUIPart(part)) return true
    return (
      part.state === 'output-available' ||
      part.state === 'output-error' ||
      part.state === 'output-denied'
    )
  })
)

const showDeploymentItems = computed(() => !active && responsePartsComplete.value)

const processItems = computed(() =>
  displayItems.value.filter((item) => item.key !== finalItem.value?.key && !isPersistentItem(item))
)

const operationCount = computed(
  () =>
    message.parts.filter((part) => isToolUIPart(part) && countsAsOperation(part as ToolPart)).length
)

const processState = computed<'pending' | 'done' | 'error'>(() => {
  const tools = message.parts.filter(isToolUIPart) as ToolPart[]
  if (tools.some((part) => part.state === 'output-error' || hasErrorOutput(part))) return 'error'
  if (active || tools.some((part) => part.state !== 'output-available')) return 'pending'
  return 'done'
})

const shouldCollapseProcess = computed(
  () => message.role === 'assistant' && !active && processItems.value.length > 0
)
</script>

<template>
  <div
    v-test-id="`chat-message-${message.role}`"
    :class="message.role === 'user' ? 'flex justify-end' : ''"
  >
    <div class="min-w-0 space-y-2" :class="message.role === 'user' ? 'max-w-[90%]' : ''">
      <template v-if="message.role === 'assistant'">
        <template v-if="shouldCollapseProcess">
          <CollapsibleRoot
            data-test-id="chat-process-group"
            class="border-l-2 border-border bg-canvas/30 px-2 py-1"
          >
            <CollapsibleTrigger class="group flex h-7 w-full min-w-0 items-center gap-2 text-left">
              <icon-lucide-triangle-alert
                v-if="processState === 'error'"
                class="size-3.5 shrink-0 text-red-400"
              />
              <icon-lucide-loader-circle
                v-else-if="processState === 'pending'"
                class="size-3.5 shrink-0 animate-spin text-accent"
              />
              <icon-lucide-check v-else class="size-3.5 shrink-0 text-green-400" />
              <span class="text-xs text-surface">{{ dialogs.aiProcess }}</span>
              <span
                v-if="operationCount > 0"
                class="shrink-0 text-[11px] whitespace-nowrap text-muted"
              >
                {{ dialogs.aiOperations({ count: operationCount }) }}
              </span>
              <icon-lucide-chevron-down
                class="ml-auto size-3 shrink-0 text-muted transition-transform group-data-[state=open]:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent class="overflow-hidden">
              <div class="space-y-2 border-t border-border/60 pt-2 pb-1">
                <ChatAssistantItem v-for="item in processItems" :key="item.key" :item="item" />
              </div>
            </CollapsibleContent>
          </CollapsibleRoot>
          <ChatAssistantItem v-for="item in leadingPersistentItems" :key="item.key" :item="item" />
          <ChatAssistantItem v-if="finalItem" :item="finalItem" summary />
          <ChatAssistantItem
            v-for="item in showDeploymentItems ? deploymentItems : []"
            :key="item.key"
            :item="item"
          />
        </template>

        <template v-else>
          <ChatAssistantItem v-for="item in nonDeploymentItems" :key="item.key" :item="item" />
          <ChatAssistantItem
            v-if="finalItemIsSynthetic && finalItem && deploymentItems.length > 0"
            :item="finalItem"
            summary
          />
          <ChatAssistantItem
            v-for="item in showDeploymentItems ? deploymentItems : []"
            :key="item.key"
            :item="item"
          />
        </template>
      </template>

      <div v-else-if="message.role === 'user'" class="space-y-1.5">
        <div
          v-if="message.parts.some(isFileUIPart)"
          class="grid max-w-full gap-1.5"
          :class="
            message.parts.filter(isFileUIPart).length === 1
              ? 'w-40 grid-cols-1'
              : 'w-64 grid-cols-2'
          "
        >
          <img
            v-for="(part, index) in message.parts.filter(isFileUIPart)"
            :key="`${part.url.slice(-24)}-${index}`"
            data-test-id="chat-message-image"
            :src="part.url"
            :alt="part.filename ?? 'Reference image'"
            class="aspect-square w-full min-w-0 rounded-md border border-border bg-canvas object-cover"
          />
        </div>
        <div
          v-if="message.parts.some((part) => isTextUIPart(part) && !!part.text)"
          data-test-id="chat-text-bubble"
          class="rounded-lg rounded-br-sm bg-accent px-3 py-2.5 text-sm leading-5 whitespace-pre-wrap text-white"
        >
          {{
            message.parts
              .filter(isTextUIPart)
              .map((part) => part.text)
              .join('')
          }}
        </div>
      </div>
    </div>
  </div>
</template>
