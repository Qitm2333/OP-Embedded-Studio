<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { PanelHeader, PanelSection } from '@/components/ui/panel'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import {
  getActiveEmbeddedDisplayProfile,
  getActiveEmbeddedImageSettings
} from '@/features/embedded-display'

import DevicePrototypeGraph from './DevicePrototypeGraph.vue'
import DevicePrototypePreview from './DevicePrototypePreview.vue'
import DevicePrototypeTransitionBar from './DevicePrototypeTransitionBar.vue'
import { useDevicePrototype } from '../composables/useDevicePrototype'
import { defaultManualSettingsForProfile, resolveDevicePrototypeTransitions } from '../model/rules'
import type {
  DevicePrototypeEventId,
  DevicePrototypeFrameCandidate,
  DevicePrototypeFrameRender,
  DevicePrototypeMode,
  DevicePrototypePortDirection,
  DevicePrototypeTransition
} from '../model/types'
import { DEVICE_PROTOTYPE_MAX_STATES, devicePrototypeEventsForProfile } from '../model/types'

const {
  scopeKey,
  selectedFrame,
  selectedFrames = [],
  renderFrame,
  renderRevision
} = defineProps<{
  active?: boolean
  scopeKey?: object
  selectedFrame?: DevicePrototypeFrameCandidate
  selectedFrames?: DevicePrototypeFrameCandidate[]
  renderFrame?: DevicePrototypeFrameRender
  renderRevision?: number
}>()

const animationFileInput = ref<HTMLInputElement>()
const animationImportError = ref('')
const selectedTransitionKey = ref('')

const {
  interactions,
  selectedInteractionId,
  selectedInteraction,
  states,
  selectedState,
  addInteraction,
  selectInteraction,
  renameInteraction,
  addFrame,
  addAnimationState,
  addFrames,
  setMode,
  setManualEvent,
  setManualLoop,
  setSlideshowInterval,
  setAnimationSettings,
  selectState,
  setTransition
} = useDevicePrototype(scopeKey)

const displayProfile = computed(() => getActiveEmbeddedDisplayProfile())
const imageSettings = computed(() => getActiveEmbeddedImageSettings())
const imagePlacement = computed(() => imageSettings.value.placement)
const backgroundColor = computed(() => imageSettings.value.backgroundColor)
const interactionSelectOptions = computed(() =>
  interactions.value.map((interaction) => ({ value: interaction.id, label: interaction.name }))
)
const modeOptions = [
  { value: 'manual', label: '手动' },
  { value: 'slideshow', label: '幻灯片' },
  { value: 'custom', label: '自定义' }
]
const mode = computed({
  get: () => selectedInteraction.value?.mode ?? 'manual',
  set: (value: string) => setMode(value as DevicePrototypeMode)
})
const displayEvents = computed(() => devicePrototypeEventsForProfile(displayProfile.value.id))
const eventOptions = computed(() =>
  displayEvents.value.map((event) => ({ value: event.id, label: event.label }))
)
const bootPresetAvailable = computed(
  () => defaultManualSettingsForProfile(displayProfile.value.id).nextEvent === 'boot_click'
)
const resolvedTransitions = computed(() =>
  selectedInteraction.value ? resolveDevicePrototypeTransitions(selectedInteraction.value) : []
)
const graphTransitions = computed(() => {
  if (selectedInteraction.value?.mode !== 'slideshow' || states.value.length < 2) {
    return resolvedTransitions.value
  }
  return states.value.map((state, index) => ({
    fromStateId: state.id,
    event: 'screen_click' as DevicePrototypeEventId,
    toStateId: states.value[(index + 1) % states.value.length].id,
    label: '自动',
    selectable: false
  }))
})
const selectedTransition = computed(
  () =>
    resolvedTransitions.value.find(
      (transition) => transitionKey(transition) === selectedTransitionKey.value
    ) ?? null
)
const canAddFrame = computed(
  () =>
    Boolean(selectedFrame?.available) &&
    states.value.length < DEVICE_PROTOTYPE_MAX_STATES &&
    !states.value.some((state) => state.frameId === selectedFrame?.id)
)
const addableSelectedFrames = computed(() =>
  selectedFrames.filter(
    (candidate) =>
      candidate.available && !states.value.some((state) => state.frameId === candidate.id)
  )
)
const canAddSelection = computed(
  () => addableSelectedFrames.value.length > 0 && states.value.length < DEVICE_PROTOTYPE_MAX_STATES
)
const selectedSourceLabel = computed(() => {
  if (selectedFrames.length > 1) return `已选中 ${selectedFrames.length} 个画面`
  return selectedFrame?.name || '未选中画面'
})
const nextEvent = computed(() => selectedInteraction.value?.manual.nextEvent ?? 'screen_click')
const previousEvent = computed(
  () => selectedInteraction.value?.manual.previousEvent ?? 'screen_long_press'
)
const slideshowSeconds = computed(
  () => (selectedInteraction.value?.slideshow.intervalMs ?? 3000) / 1000
)
const selectedAnimationDelay = computed(() => selectedState.value?.animation?.frameDelayMs ?? 50)

function transitionKey(transition: DevicePrototypeTransition): string {
  return `${transition.fromStateId}:${transition.event}:${transition.toStateId}`
}

watch(
  () => [selectedInteractionId.value, resolvedTransitions.value.map(transitionKey).join('|')],
  () => {
    if (
      !resolvedTransitions.value.some(
        (transition) => transitionKey(transition) === selectedTransitionKey.value
      )
    ) {
      selectedTransitionKey.value = ''
    }
  },
  { immediate: true }
)

function addSelectedSources() {
  if (addableSelectedFrames.value.length > 0) addFrames(addableSelectedFrames.value)
  else if (selectedFrame) addFrame(selectedFrame)
}

function chooseAnimationFiles() {
  animationImportError.value = ''
  animationFileInput.value?.click()
}

async function importAnimationState(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  try {
    if (
      files.some((file) => file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png'))
    ) {
      throw new Error('动画状态只支持 PNG 文件')
    }
    const bitmap = await createImageBitmap(files[0])
    const name =
      files[0].name.replace(/(?:[_-]?\d+)?\.png$/iu, '') || `动画状态 ${states.value.length + 1}`
    addAnimationState({ name, width: bitmap.width, height: bitmap.height, files })
    bitmap.close()
  } catch (error) {
    animationImportError.value = error instanceof Error ? error.message : String(error)
  }
}

function handleInteractionNameChange(event: Event) {
  renameInteraction((event.target as HTMLInputElement).value)
}

function handleSelectTransition(transition: DevicePrototypeTransition) {
  selectedTransitionKey.value = transitionKey(transition)
  selectState(transition.fromStateId)
}

function handleConnect(
  fromStateId: string,
  toStateId: string,
  fromPort: DevicePrototypePortDirection,
  toPort: DevicePrototypePortDirection
) {
  if (selectedInteraction.value?.mode !== 'custom') return
  const usedEvents = new Set(
    resolvedTransitions.value
      .filter((transition) => transition.fromStateId === fromStateId)
      .map((transition) => transition.event)
  )
  const event = eventOptions.value.find((option) => !usedEvents.has(option.value))?.value
  if (!event) return
  setTransition(fromStateId, event, toStateId, { fromPort, toPort })
  selectedTransitionKey.value = transitionKey({ fromStateId, event, toStateId })
  selectState(fromStateId)
}

function updateTransitionEvent(event: DevicePrototypeEventId) {
  if (!selectedTransition.value) return
  const { fromStateId, toStateId, fromPort, toPort } = selectedTransition.value
  setTransition(fromStateId, event, toStateId, { fromPort, toPort })
  selectedTransitionKey.value = transitionKey({ fromStateId, event, toStateId })
}

function updateTransitionTarget(toStateId: string) {
  if (!selectedTransition.value) return
  const { fromStateId, event, fromPort, toPort } = selectedTransition.value
  setTransition(fromStateId, event, toStateId, { fromPort, toPort })
  selectedTransitionKey.value = toStateId ? transitionKey({ fromStateId, event, toStateId }) : ''
}

function removeSelectedTransition() {
  if (!selectedTransition.value) return
  setTransition(selectedTransition.value.fromStateId, selectedTransition.value.event, '')
  selectedTransitionKey.value = ''
}

function removeGraphTransition(transition: DevicePrototypeTransition) {
  setTransition(transition.fromStateId, transition.event, '')
  if (selectedTransitionKey.value === transitionKey(transition)) selectedTransitionKey.value = ''
}

function updateManual(
  settings: Partial<{
    nextEvent: DevicePrototypeEventId
    previousEvent: DevicePrototypeEventId
    loop: boolean
  }>
) {
  if (settings.nextEvent) setManualEvent('next', settings.nextEvent)
  if (settings.previousEvent) setManualEvent('previous', settings.previousEvent)
  if (settings.loop !== undefined) setManualLoop(settings.loop)
}

function updateSlideshowSeconds(seconds: number) {
  setSlideshowInterval(seconds * 1000)
}

function updateAnimationDelay(delay: number) {
  if (selectedState.value?.animation) {
    setAnimationSettings(selectedState.value.id, { frameDelayMs: delay })
  }
}

function updateAnimationLoop(loop: boolean) {
  if (selectedState.value?.animation) {
    setAnimationSettings(selectedState.value.id, { loop })
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-panel text-surface">
    <PanelHeader>
      <template #icon>
        <icon-lucide-git-branch class="size-panel-icon" />
      </template>
      <span role="heading" aria-level="2">交互设计</span>
    </PanelHeader>

    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PanelSection label="交互方案" class="shrink-0">
        <template #actions>
          <IconButton label="新建交互" @click="addInteraction">
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </template>

        <div class="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
          <AppSelect
            :model-value="selectedInteractionId"
            :options="interactionSelectOptions"
            label="当前交互"
            @update:model-value="selectInteraction"
          />
          <input
            :key="selectedInteractionId"
            :value="selectedInteraction?.name"
            aria-label="交互方案名称"
            class="h-control w-full rounded-panel border border-transparent bg-panel-field px-2 text-xs text-surface outline-none hover:bg-panel-field-hover focus:border-panel-focus"
            @change="handleInteractionNameChange"
          />
        </div>
      </PanelSection>

      <SplitterGroup direction="vertical" class="min-h-0 flex-1 overflow-hidden">
        <SplitterPanel
          :default-size="68"
          :min-size="48"
          class="flex min-h-0 flex-col overflow-hidden"
        >
          <PanelSection
            label="交互状态图"
            class="min-h-0 flex-1 overflow-hidden"
            :ui="{
              root: 'flex min-h-0 flex-1 flex-col',
              header: 'flex h-9 min-w-0 items-center justify-between gap-2',
              title: 'min-w-0 truncate text-xs font-semibold text-surface',
              actions: 'flex h-7 w-auto shrink-0 items-center justify-end gap-1',
              body: 'min-h-0 flex-1 overflow-hidden'
            }"
          >
            <template #actions>
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-panel border border-border bg-canvas px-2 text-[10px] font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="states.length >= DEVICE_PROTOTYPE_MAX_STATES"
                @click="chooseAnimationFiles"
              >
                <icon-lucide-images class="size-3.5" />
                导入 PNG
              </button>
              <button
                type="button"
                class="flex h-7 items-center gap-1.5 rounded-panel border border-border bg-canvas px-2 text-[10px] font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!canAddSelection && !canAddFrame"
                :aria-label="
                  canAddSelection || canAddFrame
                    ? `添加${selectedFrames.length > 1 ? '选中的画面' : '当前画面'}`
                    : states.length >= DEVICE_PROTOTYPE_MAX_STATES
                      ? `最多支持 ${DEVICE_PROTOTYPE_MAX_STATES} 个画面`
                      : selectedFrame?.reason || '请先选中一个 Frame 或图片'
                "
                @click="addSelectedSources"
              >
                <icon-lucide-plus class="size-3.5" />
                添加 Frame
              </button>
            </template>

            <div class="mb-2 flex min-w-0 items-center gap-2">
              <SegmentedControl
                v-model="mode"
                :options="modeOptions"
                label="播放方式"
                class="min-w-0 flex-1"
                :ui="{ item: 'min-w-0 flex-1 px-2 text-[10px]' }"
              />
              <span class="max-w-24 truncate text-[9px] text-muted">{{ selectedSourceLabel }}</span>
              <span class="shrink-0 text-[9px] text-muted"
                >{{ states.length }}/{{ DEVICE_PROTOTYPE_MAX_STATES }}</span
              >
            </div>
            <input
              ref="animationFileInput"
              type="file"
              accept="image/png,.png"
              multiple
              class="hidden"
              @change="importAnimationState"
            />
            <p v-if="animationImportError" class="mb-2 text-[10px] text-red-300">
              {{ animationImportError }}
            </p>

            <DevicePrototypeGraph
              :states="states"
              :initial-state-id="selectedInteraction?.initialStateId || ''"
              :selected-state-id="selectedState?.id || ''"
              :selected-transition-key="selectedTransitionKey"
              :transitions="graphTransitions"
              :interaction="selectedInteraction"
              @select-state="selectState"
              @select-transition="handleSelectTransition"
              @connect="handleConnect"
              @remove-transition="removeGraphTransition"
            />
          </PanelSection>

          <DevicePrototypeTransitionBar
            :interaction="selectedInteraction"
            :states="states"
            :selected-transition="selectedTransition"
            :selected-state="selectedState"
            :selected-animation-delay="selectedAnimationDelay"
            :event-options="eventOptions"
            :next-event="nextEvent"
            :previous-event="previousEvent"
            :slideshow-seconds="slideshowSeconds"
            :boot-preset-available="bootPresetAvailable"
            @update-transition-event="updateTransitionEvent"
            @update-transition-target="updateTransitionTarget"
            @remove-transition="removeSelectedTransition"
            @update-manual="updateManual"
            @update-slideshow-seconds="updateSlideshowSeconds"
            @update-animation-delay="updateAnimationDelay"
            @update-animation-loop="updateAnimationLoop"
          />
        </SplitterPanel>
        <SplitterResizeHandle
          class="group relative z-10 h-2 shrink-0 cursor-row-resize bg-panel-field hover:bg-accent/20"
          aria-label="调整状态图和实时预览高度"
        >
          <div
            class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong group-hover:bg-accent"
          />
        </SplitterResizeHandle>
        <SplitterPanel :default-size="32" :min-size="24" class="min-h-0 overflow-hidden">
          <PanelSection
            label="实时预览"
            :default-open="true"
            class="h-full min-h-0 overflow-hidden"
            :ui="{ root: 'flex min-h-0 flex-col', body: 'min-h-0 flex-1 overflow-hidden' }"
          >
            <DevicePrototypePreview
              :open="true"
              :inline="true"
              :fit-height="true"
              :interaction="selectedInteraction"
              :render-frame="renderFrame"
              :render-revision="renderRevision"
              :profile="displayProfile"
              :placement="imagePlacement"
              :background-color="backgroundColor"
            />
          </PanelSection>
        </SplitterPanel>
      </SplitterGroup>
    </div>
  </div>
</template>
