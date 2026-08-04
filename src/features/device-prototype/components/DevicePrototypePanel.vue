<script setup lang="ts">
import { computed, ref } from 'vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import { PanelHeader, PanelSection } from '@/components/ui/panel'

import DevicePrototypePreview from './DevicePrototypePreview.vue'
import { useDevicePrototype } from '../composables/useDevicePrototype'
import type {
  DevicePrototypeEventId,
  DevicePrototypeFrameCandidate,
  DevicePrototypeFrameRender
} from '../model/types'

const { selectedFrame, renderFrame } = defineProps<{
  selectedFrame?: DevicePrototypeFrameCandidate
  renderFrame?: DevicePrototypeFrameRender
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
  removeState,
  setInitialState,
  selectState,
  transitionTarget,
  setTransition
} = useDevicePrototype()

const canAddFrame = computed(
  () =>
    Boolean(selectedFrame?.available) &&
    !states.value.some((state) => state.frameId === selectedFrame?.id)
)
const canPreview = computed(() =>
  Boolean(renderFrame && selectedInteraction.value?.initialStateId && states.value.length)
)
const interactionOptions = computed(() =>
  interactions.value.map((interaction) => ({ value: interaction.id, label: interaction.name }))
)
const NO_TRANSITION_VALUE = '__device-prototype-no-transition__'
const transitionOptions = computed(() => [
  { value: NO_TRANSITION_VALUE, label: '不跳转' },
  ...states.value.map((state) => ({ value: state.id, label: state.name }))
])

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

      <PanelSection label="界面状态" :empty="states.length === 0">
        <template #actions>
          <IconButton
            :label="
              canAddFrame ? '添加选中的画面' : selectedFrame?.reason || '请先选中一个 Frame 或图片'
            "
            :disabled="!canAddFrame"
            @click="selectedFrame && addFrame(selectedFrame)"
          >
            <icon-lucide-plus class="size-3.5" />
          </IconButton>
        </template>

        <div class="mb-panel flex min-w-0 items-center gap-2 text-[11px]">
          <span class="shrink-0 text-muted">画布选择</span>
          <span class="min-w-0 flex-1 truncate text-surface">
            {{ selectedFrame?.name || '未选中画面' }}
          </span>
          <span class="shrink-0 text-muted">{{ states.length }} 个</span>
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
            <IconButton label="移除界面" @click="removeState(state.id)">
              <icon-lucide-x class="size-3" />
            </IconButton>
          </div>
        </div>
      </PanelSection>

      <PanelSection label="事件跳转" :empty="!selectedState">
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
    />
  </div>
</template>
