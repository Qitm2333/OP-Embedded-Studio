<script setup lang="ts">
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'

import type {
  DevicePrototypeEventId,
  DevicePrototypeInteraction,
  DevicePrototypeManualSettings,
  DevicePrototypeState,
  DevicePrototypeTransition
} from '../model/types'

const {
  interaction,
  states,
  selectedTransition,
  selectedState,
  selectedAnimationDelay,
  eventOptions,
  nextEvent,
  previousEvent,
  slideshowSeconds,
  bootPresetAvailable
} = defineProps<{
  interaction: DevicePrototypeInteraction | null
  states: DevicePrototypeState[]
  selectedTransition: DevicePrototypeTransition | null
  selectedState: DevicePrototypeState | null
  selectedAnimationDelay: number
  eventOptions: Array<{ value: DevicePrototypeEventId; label: string }>
  nextEvent: DevicePrototypeEventId
  previousEvent: DevicePrototypeEventId
  slideshowSeconds: number
  bootPresetAvailable: boolean
}>()

const emit = defineEmits<{
  'update-transition-event': [event: DevicePrototypeEventId]
  'update-transition-target': [targetId: string]
  'remove-transition': []
  'update-manual': [settings: Partial<DevicePrototypeManualSettings>]
  'update-slideshow-seconds': [seconds: number]
  'update-animation-delay': [delay: number]
  'update-animation-loop': [loop: boolean]
}>()

const stateOptions = () => states.map((state) => ({ value: state.id, label: state.name }))
const NO_TARGET = '__device-prototype-no-target__'

function targetValue(): string {
  return selectedTransition?.toStateId || NO_TARGET
}

function updateTarget(value: string) {
  emit('update-transition-target', value === NO_TARGET ? '' : value)
}

function updateManualLoop(event: Event) {
  emit('update-manual', { loop: (event.target as HTMLInputElement).checked })
}

function updateAnimationLoop(event: Event) {
  emit('update-animation-loop', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div
    data-test-id="device-prototype-transition-bar"
    class="shrink-0 border-t border-border bg-panel px-panel py-2"
  >
    <div class="flex min-w-0 items-center gap-2">
      <icon-lucide-git-branch class="size-3.5 shrink-0 text-muted" />

      <template v-if="interaction?.mode === 'custom' && selectedTransition">
        <span class="min-w-0 max-w-24 truncate text-[10px] text-surface">
          {{ states.find((state) => state.id === selectedTransition?.fromStateId)?.name }}
        </span>
        <icon-lucide-arrow-right class="size-3 shrink-0 text-muted" />
        <AppSelect
          :model-value="selectedTransition.event"
          :options="eventOptions"
          label="切换触发事件"
          class="min-w-28 flex-1"
          @update:model-value="emit('update-transition-event', $event)"
        />
        <icon-lucide-arrow-right class="size-3 shrink-0 text-muted" />
        <AppSelect
          :model-value="targetValue()"
          :options="[{ value: NO_TARGET, label: '不跳转' }, ...stateOptions()]"
          label="切换目标界面"
          class="min-w-24 flex-1"
          @update:model-value="updateTarget"
        />
        <IconButton label="删除这条连线" @click="emit('remove-transition')">
          <icon-lucide-trash-2 class="size-3.5" />
        </IconButton>
      </template>

      <template v-else-if="interaction?.mode === 'custom'">
        <span class="min-w-0 flex-1 truncate text-[10px] text-muted">
          点击状态之间的连线，在这里配置切换事件
        </span>
      </template>

      <template v-else-if="interaction?.mode === 'manual'">
        <span class="shrink-0 text-[10px] text-muted">下一张</span>
        <AppSelect
          :model-value="nextEvent"
          :options="eventOptions"
          label="下一张触发事件"
          class="min-w-24 flex-1"
          @update:model-value="emit('update-manual', { nextEvent: $event })"
        />
        <span class="shrink-0 text-[10px] text-muted">上一张</span>
        <AppSelect
          :model-value="previousEvent"
          :options="eventOptions"
          label="上一张触发事件"
          class="min-w-24 flex-1"
          @update:model-value="emit('update-manual', { previousEvent: $event })"
        />
        <label class="flex shrink-0 items-center gap-1 text-[10px] text-surface">
          <input
            type="checkbox"
            class="size-3.5 accent-accent"
            :checked="interaction.manual.loop"
            @change="updateManualLoop"
          />
          循环
        </label>
      </template>

      <template v-else-if="interaction?.mode === 'slideshow'">
        <span class="shrink-0 text-[10px] text-muted">自动切换</span>
        <AppInput
          :model-value="slideshowSeconds"
          type="number"
          :min="0.5"
          :max="60"
          :step="0.5"
          tone="panel"
          size="sm"
          class="min-w-20 flex-1"
          @update:model-value="emit('update-slideshow-seconds', Number($event))"
        />
        <span class="shrink-0 text-[10px] text-muted">秒</span>
      </template>
    </div>
    <button
      v-if="
        interaction?.mode === 'manual' &&
        bootPresetAvailable &&
        (nextEvent !== 'boot_click' || previousEvent !== 'boot_long_press')
      "
      type="button"
      class="mt-1.5 text-[10px] text-accent hover:underline"
      @click="emit('update-manual', { nextEvent: 'boot_click', previousEvent: 'boot_long_press' })"
    >
      使用 BOOT
    </button>
    <div
      v-if="selectedState?.animation"
      class="mt-1.5 flex min-w-0 items-center gap-2 border-t border-border pt-1.5"
    >
      <icon-lucide-images class="size-3.5 shrink-0 text-muted" />
      <span class="shrink-0 text-[10px] text-muted">PNG 序列</span>
      <label class="flex min-w-0 flex-1 items-center gap-1 text-[10px] text-muted">
        帧间隔
        <AppInput
          :model-value="selectedAnimationDelay"
          type="number"
          :min="16"
          :max="2000"
          :step="1"
          tone="panel"
          size="sm"
          class="min-w-16 flex-1"
          @update:model-value="emit('update-animation-delay', Number($event))"
        />
        ms
      </label>
      <label class="flex shrink-0 items-center gap-1 text-[10px] text-surface">
        <input
          type="checkbox"
          class="size-3.5 accent-accent"
          :checked="selectedState.animation.loop"
          @change="updateAnimationLoop"
        />
        循环
      </label>
    </div>
  </div>
</template>
