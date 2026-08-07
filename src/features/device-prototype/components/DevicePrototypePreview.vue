<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import { useEventListener } from '@vueuse/core'

import {
  EmbeddedDisplayContentPreview,
  embeddedImagePlacementLabel,
  type EmbeddedImagePlacement
} from '@/features/embedded-display'
import { DEVICE_PROTOTYPE_EVENTS } from '../model/types'
import { resolveDevicePrototypeTransitions } from '../model/rules'
import type {
  DevicePrototypeEventId,
  DevicePrototypeFrameRender,
  DevicePrototypeInteraction,
  DevicePrototypePreviewProfile
} from '../model/types'

const { open, interaction, renderFrame, renderRevision, profile, placement, backgroundColor } =
  defineProps<{
    open: boolean
    interaction: DevicePrototypeInteraction | null
    renderFrame?: DevicePrototypeFrameRender
    renderRevision?: number
    profile: DevicePrototypePreviewProfile
    placement: EmbeddedImagePlacement
    backgroundColor: string
  }>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const currentStateId = ref('')
const previewUrl = ref('')
const previewError = ref('')
const previewLoading = ref(false)
const lastEventLabel = ref('等待操作')
const clickCount = ref(0)
const slideshowPaused = ref(false)
const renderNonce = ref(0)
let clickTimer: ReturnType<typeof setTimeout> | undefined
let longPressTimer: ReturnType<typeof setTimeout> | undefined
let slideshowTimer: ReturnType<typeof setTimeout> | undefined
let longPressTriggered = false
let renderRequest = 0

const currentState = computed(
  () => interaction?.states.find((state) => state.id === currentStateId.value) ?? null
)
const resolvedTransitions = computed(() =>
  interaction ? resolveDevicePrototypeTransitions(interaction) : []
)

function clearPreviewUrl() {
  if (!previewUrl.value) return
  URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
}

async function renderCurrentState() {
  const request = ++renderRequest
  clearPreviewUrl()
  previewError.value = ''
  if (!currentState.value || !renderFrame) return
  previewLoading.value = true
  try {
    const blob = await renderFrame(currentState.value.frameId)
    if (!blob) throw new Error('无法渲染当前 Frame')
    if (request !== renderRequest || !open) return
    previewUrl.value = URL.createObjectURL(blob)
  } catch (error) {
    if (request !== renderRequest || !open) return
    previewError.value = error instanceof Error ? error.message : String(error)
  } finally {
    if (request === renderRequest) previewLoading.value = false
  }
}

function resetPreview() {
  clearSlideshowTimer()
  clickCount.value = 0
  if (clickTimer) clearTimeout(clickTimer)
  clickTimer = undefined
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
  currentStateId.value = interaction?.initialStateId ?? ''
  slideshowPaused.value = false
  lastEventLabel.value = '已回到初始状态'
  renderNonce.value += 1
  scheduleSlideshow()
}

function closePreview() {
  clearSlideshowTimer()
  if (clickTimer) clearTimeout(clickTimer)
  if (longPressTimer) clearTimeout(longPressTimer)
  clickTimer = undefined
  longPressTimer = undefined
  renderRequest += 1
  previewLoading.value = false
  clearPreviewUrl()
  emit('update:open', false)
}

function clearSlideshowTimer() {
  if (!slideshowTimer) return
  clearTimeout(slideshowTimer)
  slideshowTimer = undefined
}

function advanceSlideshow() {
  if (!interaction || interaction.mode !== 'slideshow' || interaction.states.length < 2) return
  const index = interaction.states.findIndex((state) => state.id === currentStateId.value)
  const next = interaction.states[(index + 1) % interaction.states.length]
  if (!next) return
  currentStateId.value = next.id
  lastEventLabel.value = '自动播放'
}

function scheduleSlideshow() {
  clearSlideshowTimer()
  if (
    !open ||
    slideshowPaused.value ||
    !interaction ||
    interaction.mode !== 'slideshow' ||
    interaction.states.length < 2
  ) {
    return
  }
  slideshowTimer = setTimeout(advanceSlideshow, interaction.slideshow.intervalMs)
}

function toggleSlideshow() {
  slideshowPaused.value = !slideshowPaused.value
  lastEventLabel.value = slideshowPaused.value ? '已暂停' : '继续播放'
}

function handleKeydown(event: KeyboardEvent) {
  if (open && event.key === 'Escape') closePreview()
}

function dispatch(eventId: DevicePrototypeEventId) {
  if (!interaction || !currentStateId.value) return
  const eventLabel = DEVICE_PROTOTYPE_EVENTS.find((item) => item.id === eventId)?.label ?? eventId
  const transition = resolvedTransitions.value.find(
    (item) => item.fromStateId === currentStateId.value && item.event === eventId
  )
  lastEventLabel.value = transition ? eventLabel : `${eventLabel} · 未配置跳转`
  if (transition) currentStateId.value = transition.toStateId
}

function flushScreenClicks() {
  let eventId: DevicePrototypeEventId = 'screen_click'
  if (clickCount.value >= 3) eventId = 'screen_triple_click'
  else if (clickCount.value === 2) eventId = 'screen_double_click'
  clickCount.value = 0
  clickTimer = undefined
  dispatch(eventId)
}

function handleScreenPointerDown() {
  if (interaction?.mode === 'slideshow') return
  longPressTriggered = false
  longPressTimer = setTimeout(() => {
    longPressTriggered = true
    clickCount.value = 0
    if (clickTimer) clearTimeout(clickTimer)
    clickTimer = undefined
    dispatch('screen_long_press')
  }, 600)
}

function handleScreenPointerUp() {
  if (interaction?.mode === 'slideshow') return
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
  if (longPressTriggered) return
  const usesMultiClick = resolvedTransitions.value.some(
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
  }, 600)
}

function handleBootPointerUp() {
  if (longPressTimer) clearTimeout(longPressTimer)
  longPressTimer = undefined
  if (!longPressTriggered) dispatch('boot_click')
}

watch(
  () => [open, interaction?.id, interaction?.initialStateId],
  () => {
    if (open) resetPreview()
  },
  { immediate: true }
)
watch(
  () => [currentStateId.value, renderRevision, renderNonce.value],
  () => void renderCurrentState(),
  { immediate: true }
)
watch(
  () => [
    open,
    interaction?.mode,
    interaction?.slideshow.intervalMs,
    currentStateId.value,
    slideshowPaused.value
  ],
  scheduleSlideshow
)

watch(
  () => open,
  (isOpen) => {
    if (!isOpen) {
      clearSlideshowTimer()
      renderRequest += 1
      previewLoading.value = false
      clearPreviewUrl()
    }
  }
)

useEventListener(window, 'keydown', handleKeydown)

onUnmounted(() => {
  if (clickTimer) clearTimeout(clickTimer)
  if (longPressTimer) clearTimeout(longPressTimer)
  clearSlideshowTimer()
  clearPreviewUrl()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
      @click.self="closePreview"
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
            type="button"
            v-if="interaction?.mode === 'slideshow'"
            class="rounded px-2 py-1 text-xs text-muted hover:text-surface"
            @click="toggleSlideshow"
          >
            {{ slideshowPaused ? '继续' : '暂停' }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-muted hover:text-surface"
            @click="resetPreview"
          >
            重新开始
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs text-muted hover:text-surface"
            @click="closePreview"
          >
            关闭
          </button>
        </header>
        <div
          class="flex min-h-0 flex-1 items-center justify-center gap-6 overflow-auto bg-canvas p-6"
        >
          <div class="flex min-w-0 flex-col items-center gap-3">
            <div
              class="relative max-h-[68vh] max-w-full select-none overflow-hidden rounded-lg bg-black shadow-lg"
              :style="{
                aspectRatio: `${profile.resolution.width} / ${profile.resolution.height}`,
                width: 'min(68vh, 420px)',
                backgroundColor:
                  previewUrl && profile.visibleArea?.shape === 'round'
                    ? 'transparent'
                    : backgroundColor,
                borderRadius: profile.visibleArea?.shape === 'round' ? '9999px' : undefined
              }"
              @contextmenu.prevent
              @pointerdown="handleScreenPointerDown"
              @pointerup="handleScreenPointerUp"
              @pointerleave="handlePointerCancel"
              @pointercancel="handlePointerCancel"
            >
              <EmbeddedDisplayContentPreview
                v-if="previewUrl"
                :src="previewUrl"
                :alt="currentState?.name || 'device preview'"
                :placement="placement"
                :background-color="backgroundColor"
                :target-width="profile.resolution.width"
                :target-height="profile.resolution.height"
                :source-width="currentState?.width"
                :source-height="currentState?.height"
                :round="profile.visibleArea?.shape === 'round'"
                class="size-full border-0"
              />
              <span
                v-else-if="previewLoading"
                class="absolute inset-0 flex items-center justify-center text-xs text-white/60"
              >
                正在渲染 Frame…
              </span>
              <span
                v-else
                class="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/60"
              >
                {{ previewError || '请选择包含状态的交互' }}
              </span>
            </div>
            <p class="text-center text-[11px] text-muted">
              {{ profile.name }} · {{ profile.resolution.width }} ×
              {{ profile.resolution.height }} ·
              {{ embeddedImagePlacementLabel(placement) }}
            </p>
            <p class="text-center text-[11px] text-muted">
              {{
                interaction?.mode === 'slideshow'
                  ? `每 ${(interaction.slideshow.intervalMs / 1000).toFixed(1)} 秒自动切换`
                  : '屏幕支持单击、双击、三击和长按'
              }}
            </p>
          </div>
          <div
            v-if="interaction?.mode !== 'slideshow'"
            class="flex shrink-0 flex-col items-center gap-2"
          >
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
