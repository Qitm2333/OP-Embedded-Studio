<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { PanelHeader, PanelSection } from '@/components/ui/panel'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import {
  getActiveEmbeddedDisplayProfile,
  getActiveEmbeddedImageSettings
} from '@/features/embedded-display'

import DevicePrototypePreview from './DevicePrototypePreview.vue'
import { useDevicePrototype } from '../composables/useDevicePrototype'
import type {
  DevicePrototypeEventId,
  DevicePrototypeFrameCandidate,
  DevicePrototypeFrameRender,
  DevicePrototypeMode
} from '../model/types'
import { DEVICE_PROTOTYPE_MAX_STATES } from '../model/types'

const {
  active = true,
  selectedFrame,
  selectedFrames = [],
  renderFrame,
  renderRevision
} = defineProps<{
  active?: boolean
  selectedFrame?: DevicePrototypeFrameCandidate
  selectedFrames?: DevicePrototypeFrameCandidate[]
  renderFrame?: DevicePrototypeFrameRender
  renderRevision?: number
}>()

const previewOpen = ref(false)
const {
  events,
  interactions,
  selectedInteractionId,
  selectedInteraction,
  states,
  initialStateId,
  selectedStateId,
  selectedState,
  addInteraction,
  removeInteraction,
  selectInteraction,
  renameInteraction,
  addFrame,
  addFrames,
  removeState,
  moveState,
  setInitialState,
  setMode,
  setManualEvent,
  setManualLoop,
  setSlideshowInterval,
  selectState,
  transitionTarget,
  setTransition
} = useDevicePrototype()

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
const canPreview = computed(() =>
  Boolean(renderFrame && selectedInteraction.value?.initialStateId && states.value.length)
)
const displayProfile = computed(() => getActiveEmbeddedDisplayProfile())
const imageSettings = computed(() => getActiveEmbeddedImageSettings())
watch(
  () => active,
  (isActive) => {
    if (!isActive) previewOpen.value = false
  }
)
const interactionOptions = computed(() =>
  interactions.value.map((interaction) => ({ value: interaction.id, label: interaction.name }))
)
const NO_TRANSITION_VALUE = '__device-prototype-no-transition__'
const transitionOptions = computed(() => [
  { value: NO_TRANSITION_VALUE, label: '不跳转' },
  ...states.value.map((state) => ({ value: state.id, label: state.name }))
])
const eventOptions = computed(() =>
  events.map((event) => ({ value: event.id, label: event.label }))
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
const nextEvent = computed({
  get: () => selectedInteraction.value?.manual.nextEvent ?? 'screen_click',
  set: (value: DevicePrototypeEventId) => setManualEvent('next', value)
})
const previousEvent = computed({
  get: () => selectedInteraction.value?.manual.previousEvent ?? 'screen_long_press',
  set: (value: DevicePrototypeEventId) => setManualEvent('previous', value)
})
const slideshowSeconds = computed({
  get: () => (selectedInteraction.value?.slideshow.intervalMs ?? 3000) / 1000,
  set: (value: string | number) => setSlideshowInterval(Number(value) * 1000)
})
const selectedSourceLabel = computed(() => {
  if (selectedFrames.length > 1) return `已选中 ${selectedFrames.length} 个画面`
  return selectedFrame?.name || '未选中画面'
})

function addSelectedSources() {
  if (addableSelectedFrames.value.length > 0) addFrames(addableSelectedFrames.value)
  else if (selectedFrame) addFrame(selectedFrame)
}

function handleManualLoopChange(event: Event) {
  setManualLoop((event.target as HTMLInputElement).checked)
}

function handleInteractionNameChange(event: Event) {
  renameInteraction((event.target as HTMLInputElement).value)
}

function transitionSelectValue(stateId: string, eventId: DevicePrototypeEventId): string {
  return transitionTarget(stateId, eventId) || NO_TRANSITION_VALUE
}

function updateTransition(eventId: DevicePrototypeEventId, targetId: string) {
  if (!selectedState.value) return
  setTransition(selectedState.value.id, eventId, targetId === NO_TRANSITION_VALUE ? '' : targetId)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-panel text-surface">
    <PanelHeader>
      <template #icon>
        <icon-lucide-git-branch class="size-panel-icon" />
      </template>
      <span role="heading" aria-level="2">{{ selectedInteraction?.name || '交互原型' }}</span>
      <template #actions>
        <IconButton label="预览交互" :disabled="!canPreview" @click="previewOpen = true">
          <icon-lucide-play class="size-3.5" />
        </IconButton>
      </template>
    </PanelHeader>

    <div class="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-4">
      <PanelSection label="交互">
        <template #actions>
          <IconButton label="新建交互" @click="addInteraction">
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
          <IconButton
            label="删除当前交互"
            :disabled="interactions.length <= 1"
            @click="removeInteraction(selectedInteractionId)"
          >
            <icon-lucide-trash-2 class="size-3.5" />
          </IconButton>
        </template>

        <div class="grid gap-panel">
          <AppSelect
            :model-value="selectedInteractionId"
            :options="interactionOptions"
            label="当前交互"
            @update:model-value="selectInteraction"
          />
          <label class="grid gap-1 text-[11px] text-muted">
            名称
            <input
              :key="selectedInteractionId"
              :value="selectedInteraction?.name"
              class="h-control w-full rounded-panel border border-transparent bg-panel-field px-2 text-xs text-surface outline-none hover:bg-panel-field-hover focus:border-panel-focus"
              @change="handleInteractionNameChange"
            />
          </label>
        </div>
      </PanelSection>

      <PanelSection label="模式">
        <SegmentedControl
          v-model="mode"
          :options="modeOptions"
          label="交互模式"
          size="md"
          :ui="{
            root: 'flex w-full',
            item: 'min-w-[72px] px-2 font-medium text-surface/80'
          }"
        >
          <template #option="{ option }">
            <span class="whitespace-nowrap">{{ option.label }}</span>
          </template>
        </SegmentedControl>

        <div v-if="selectedInteraction?.mode === 'manual'" class="mt-panel grid gap-panel">
          <div class="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-panel">
            <span class="text-xs font-medium text-surface/80">下一张</span>
            <AppSelect v-model="nextEvent" :options="eventOptions" label="下一张触发事件" />
            <span class="text-xs font-medium text-surface/80">上一张</span>
            <AppSelect v-model="previousEvent" :options="eventOptions" label="上一张触发事件" />
          </div>
          <label class="flex h-control items-center gap-2 text-[11px] text-surface">
            <input
              type="checkbox"
              class="size-3.5 accent-accent"
              :checked="selectedInteraction.manual.loop"
              @change="handleManualLoopChange"
            />
            首尾循环
          </label>
        </div>

        <div v-else-if="selectedInteraction?.mode === 'slideshow'" class="mt-panel grid gap-1">
          <label class="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-panel">
            <span class="text-[11px] text-muted">停留时间</span>
            <div class="grid grid-cols-[minmax(0,1fr)_20px] items-center gap-1">
              <AppInput
                v-model="slideshowSeconds"
                type="number"
                :min="0.5"
                :max="60"
                :step="0.5"
                tone="panel"
                size="sm"
              />
              <span class="text-[11px] text-muted">秒</span>
            </div>
          </label>
        </div>
      </PanelSection>

      <PanelSection label="界面状态" :empty="states.length === 0">
        <template #actions>
          <IconButton
            :label="
              canAddSelection || canAddFrame
                ? `添加${selectedFrames.length > 1 ? '选中的画面' : '当前画面'}`
                : states.length >= DEVICE_PROTOTYPE_MAX_STATES
                  ? `最多支持 ${DEVICE_PROTOTYPE_MAX_STATES} 个画面`
                  : selectedFrame?.reason || '请先选中一个 Frame 或图片'
            "
            :disabled="!canAddSelection && !canAddFrame"
            @click="addSelectedSources"
          >
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </template>

        <div class="mb-panel flex min-w-0 items-center gap-2 text-[11px]">
          <span class="shrink-0 text-muted">画布选择</span>
          <span class="min-w-0 flex-1 truncate text-surface">
            {{ selectedSourceLabel }}
          </span>
          <span class="shrink-0 text-muted">
            {{ states.length }} / {{ DEVICE_PROTOTYPE_MAX_STATES }}
          </span>
        </div>

        <p v-if="states.length === 0" class="text-[11px] leading-relaxed text-muted">
          选中一个 Frame 或图片，然后点击右上角加号添加为第一个界面状态。
        </p>

        <div v-else class="grid gap-1">
          <div
            v-for="state in states"
            :key="state.id"
            class="flex min-w-0 items-center gap-1 rounded-panel border px-1 py-1"
            :class="
              state.id === selectedStateId ? 'border-panel-focus bg-hover' : 'border-transparent'
            "
          >
            <button
              type="button"
              class="min-w-0 flex-1 rounded-panel px-1 py-0.5 text-left hover:bg-hover"
              @click="selectState(state.id)"
            >
              <span class="block truncate text-xs text-surface">{{ state.name }}</span>
              <span class="block truncate text-[10px] text-muted">
                {{ state.width }} × {{ state.height }}
                <template v-if="state.id === initialStateId"> · 初始界面</template>
              </span>
            </button>
            <IconButton
              label="设为初始界面"
              :active="state.id === initialStateId"
              @click="setInitialState(state.id)"
            >
              <icon-lucide-house class="size-3" />
            </IconButton>
            <IconButton
              label="上移画面"
              :disabled="states[0]?.id === state.id"
              @click="moveState(state.id, -1)"
            >
              <icon-lucide-chevron-up class="size-3" />
            </IconButton>
            <IconButton
              label="下移画面"
              :disabled="states.at(-1)?.id === state.id"
              @click="moveState(state.id, 1)"
            >
              <icon-lucide-chevron-down class="size-3" />
            </IconButton>
            <IconButton label="移除界面" @click="removeState(state.id)">
              <icon-lucide-x class="size-3" />
            </IconButton>
          </div>
        </div>
      </PanelSection>

      <PanelSection
        v-if="selectedInteraction?.mode === 'custom'"
        label="事件跳转"
        :empty="!selectedState"
      >
        <p v-if="!selectedState" class="text-[11px] leading-relaxed text-muted">
          选择一个界面状态后，为点击、长按和 BOOT 操作设置目标界面。
        </p>
        <div v-else class="grid gap-1.5">
          <div
            v-for="event in events"
            :key="event.id"
            class="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-panel"
          >
            <span class="truncate text-[11px] text-muted">{{ event.label }}</span>
            <AppSelect
              :model-value="transitionSelectValue(selectedState.id, event.id)"
              :options="transitionOptions"
              :label="`${event.label}的目标界面`"
              @update:model-value="updateTransition(event.id, $event)"
            />
          </div>
        </div>
      </PanelSection>
    </div>

    <DevicePrototypePreview
      v-model:open="previewOpen"
      :interaction="selectedInteraction"
      :render-frame="renderFrame"
      :render-revision="renderRevision"
      :profile="displayProfile"
      :placement="imageSettings.placement"
      :background-color="imageSettings.backgroundColor"
    />
  </div>
</template>
