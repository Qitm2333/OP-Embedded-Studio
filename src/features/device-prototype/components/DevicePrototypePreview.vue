<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import { DEVICE_PROTOTYPE_EVENTS } from '../model/types'
import type {
  DevicePrototypeEventId,
  DevicePrototypeFrameRender,
  DevicePrototypeInteraction
} from '../model/types'

const props = defineProps<{
  open: boolean
  interaction: DevicePrototypeInteraction | null
  renderFrame?: DevicePrototypeFrameRender
}>()

const emit = defineEmits<{ close: [] }>()
const currentStateId = ref('')
const previewUrl = ref('')
const previewError = ref('')
const previewLoading = ref(false)
const lastEventLabel = ref('等待操作')
const clickCount = ref(0)
let clickTimer: ReturnType<typeof setTimeout> | undefined
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let longPressTriggered = false

const currentState = computed(
  () => props.interaction?.states.find((state) => state.id === currentStateId.value) ?? null
)

function clearPreviewUrl() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function renderCurrentState() {
  clearPreviewUrl()
  previewError.value = ''
  if (!currentState.value || !props.renderFrame) return
  previewLoading.value = true
  try {
    const blob = await props.renderFrame(currentState.value.frameId)
    if (!blob) throw new Error('无法渲染当前 Frame')
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    previewLoading.value = false
  }
}

function resetPreview() {
  currentStateId.value = props.interaction?.initialStateId ?? ''
  lastEventLabel.value = '已回到初始状态'
}

function dispatch(eventId: DevicePrototypeEventId) {
  const interaction = props.interaction
  if (!interaction || !currentStateId.value) return
  const eventLabel = DEVICE_PROTOTYPE_EVENTS.find((item) => item.id === eventId)?.label ?? eventId
  const transition = interaction.transitions.find(
    (item) => item.fromStateId === currentStateId.value && item.event === eventId
  )
  lastEventLabel.value = transition ? eventLabel : `${eventLabel} · 未配置跳转`
  if (transition) currentStateId.value = transition.toStateId
}

function flushScreenClicks() {
  const eventId =
    clickCount.value >= 3
      ? 'screen_triple_click'
      : clickCount.value === 2
        ? 'screen_double_click'
        : 'screen_click'
  clickCount.value = 0
  clickTimer = undefined
  dispatch(eventId)
}

function handleScreenPointerDown() {
  longPressTriggered = false
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    clickCount.value = 0
    if (clickTimer) clearTimeout(clickTimer)
    clickTimer = undefined
    dispatch('screen_long_press')
  }, 550)
}

function handleScreenPointerUp() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
  if (longPressTriggered) return
  const usesMultiClick = props.interaction?.transitions.some(
    (transition) =>
      transition.fromStateId === currentStateId.value &&
      (transition.event === 'screen_double_click' || transition.event === 'screen_triple_click')
  )
  if (!usesMultiClick) {
    dispatch('screen_click')
    return
  }
  clickCount.value += 1
  if (clickCount.value >= 3) {
    if (clickTimer) clearTimeout(clickTimer)
    flushScreenClicks()
    return
  }
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = setTimeout(flushScreenClicks, 320)
}

function handlePointerCancel() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function handleBootPointerDown() {
  longPressTriggered = false
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    dispatch('boot_long_press')
  }, 550)
}

function handleBootPointerUp() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
  if (!longPressTriggered) dispatch('boot_click')
}

watch(
  () => [props.open, props.interaction?.id, props.interaction?.initialStateId],
  () => {
    if (props.open) resetPreview()
  },
  { immediate: true }
)
watch(currentStateId, () => void renderCurrentState(), { immediate: true })

onUnmounted(() => {
  if (clickTimer) clearTimeout(clickTimer)
  if (longPressTimer) clearTimeout(longPressTimer)
  clearPreviewUrl()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
      @click.self="emit('close')"
    >
      <div
        class="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
      >
        <header class="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold text-surface">
              {{ interaction?.name || '交互预览' }}
            </div>
            <div class="truncate text-[11px] text-muted">
              {{ currentState?.name || '没有可预览的状态' }} · {{ lastEventLabel }}
            </div>
          </div>
          <button
            class="rounded px-2 py-1 text-xs text-muted hover:text-surface"
            @click="resetPreview"
          >
            重新开始
          </button>
          <button
            class="rounded px-2 py-1 text-xs text-muted hover:text-surface"
            @click="emit('close')"
          >
            关闭
          </button>
        </header>
        <div
          class="flex min-h-0 flex-1 items-center justify-center gap-6 overflow-auto bg-canvas p-6"
        >
          <div class="flex min-w-0 flex-col items-center gap-3">
            <div
              class="relative flex max-h-[68vh] max-w-full select-none items-center justify-center overflow-hidden rounded-lg border border-border bg-black shadow-lg"
              :style="{
                aspectRatio: currentState ? `${currentState.width} / ${currentState.height}` : '1',
                width: currentState ? `min(${currentState.width}px, 68vh)` : '360px'
              }"
              @contextmenu.prevent
              @pointerdown="handleScreenPointerDown"
              @pointerup="handleScreenPointerUp"
              @pointerleave="handlePointerCancel"
              @pointercancel="handlePointerCancel"
            >
              <img
                v-if="previewUrl"
                :src="previewUrl"
                class="size-full object-contain"
                draggable="false"
              />
              <span v-else-if="previewLoading" class="text-xs text-white/60">
                正在渲染 Frame…
              </span>
              <span v-else class="px-6 text-center text-xs text-white/60">
                {{ previewError || '请选择包含状态的交互' }}
              </span>
            </div>
            <p class="text-center text-[11px] text-muted">屏幕支持单击、双击、三击和长按</p>
          </div>
          <div class="flex shrink-0 flex-col items-center gap-2">
            <button
              type="button"
              class="flex size-16 select-none items-center justify-center rounded-full border-4 border-border bg-panel text-xs font-semibold text-surface shadow active:scale-95"
              @pointerdown="handleBootPointerDown"
              @pointerup="handleBootPointerUp"
              @pointerleave="handlePointerCancel"
              @pointercancel="handlePointerCancel"
            >
              BOOT
            </button>
            <span class="text-[11px] text-muted">单击 / 长按</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
