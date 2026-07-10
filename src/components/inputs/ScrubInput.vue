<script lang="ts">
import type { ComponentUI } from '@/components/ui/types'
import type { ScrubInputTheme } from '@/theme/scrub-input'

export type ScrubInputUI = ComponentUI<ScrubInputTheme>

export interface ScrubInputProps {
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  icon?: string
  label?: string
  suffix?: string
  sensitivity?: number
  placeholder?: string
  ui?: ScrubInputUI
}
</script>

<script setup lang="ts">
import { computed, normalizeClass, useAttrs, useSlots } from 'vue'
import { tv } from 'tailwind-variants'
import { ScrubInputRoot, ScrubInputField, ScrubInputDisplay, testId } from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import theme from '@/theme/scrub-input'

const attrs = useAttrs()
const slots = useSlots()
const store = useEditorStore()

const rootTestId = computed(() => (attrs['data-test-id'] as string | undefined) ?? 'scrub-input')

const { modelValue, min, max, step, icon, label, suffix, sensitivity, placeholder, ui } =
  defineProps<ScrubInputProps>()
const styles = computed(() => tv(theme)({ suffix: Boolean(slots.suffix) }))

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'editing-change': [editing: boolean]
  commit: [value: number, previous: number]
}>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <ScrubInputRoot
    v-slot="{ editing, actions, placeholder: ph }"
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :sensitivity="sensitivity"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
    @commit="(val: number, prev: number) => emit('commit', val, prev)"
    @editing-change="
      (editing: boolean) => {
        store.state.scrubInputFocused = editing
        emit('editing-change', editing)
      }
    "
  >
    <div
      v-bind="{ ...attrs, ...testId(rootTestId) }"
      :tabindex="editing ? undefined : 0"
      :class="styles.root({ class: [ui?.root, normalizeClass(attrs.class)] })"
      :style="{ cursor: editing ? 'auto' : 'ew-resize' }"
      @pointerdown="
        !editing &&
        !($event.target as HTMLElement)?.closest?.('button') &&
        actions.startScrub($event)
      "
      @focus="!editing && actions.startEdit()"
    >
      <span v-if="attrs['data-test-id']" data-test-id="scrub-input" class="hidden" />
      <span :class="styles.leading({ class: ui?.leading })">
        <slot name="icon">
          <span v-if="icon" class="text-[11px] leading-none">{{ icon }}</span>
        </slot>
        <span v-if="label" class="text-[11px] leading-none">{{ label }}</span>
      </span>
      <ScrubInputField
        data-test-id="scrub-input-field"
        :class="styles.field({ class: ui?.field })"
        :min="min === -Infinity ? undefined : min"
        :max="max === Infinity ? undefined : max"
        :step="step"
      />
      <slot v-if="editing" name="suffix" />
      <ScrubInputDisplay :class="styles.display({ class: ui?.display })">
        <template #default="{ value, isMixed: mixed }">
          <span v-if="mixed" :class="styles.mixed({ class: ui?.mixed })">{{ ph }}</span>
          <template v-else>
            <span :class="styles.value({ class: ui?.value })">{{ value }}</span>
            <span v-if="suffix" :class="styles.suffix({ class: ui?.suffix })">{{ suffix }}</span>
          </template>
          <slot name="suffix" />
        </template>
      </ScrubInputDisplay>
    </div>
  </ScrubInputRoot>
</template>
