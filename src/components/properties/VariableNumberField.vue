<script setup lang="ts">
import { computed } from 'vue'
import { BindableValueRoot, useI18n, useNumberBindingProvider } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import BoundVariableButton from '@/components/properties/BoundVariableButton.vue'
import VariablePickerPopover from '@/components/properties/VariablePickerPopover.vue'

import type { BindingTarget, NumberBindingPath } from '@open-pencil/vue'

const {
  modelValue,
  min,
  max,
  step,
  icon,
  label,
  suffix,
  sensitivity,
  placeholder,
  nodeId,
  bindingPath
} = defineProps<{
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  icon?: string
  label?: string
  suffix?: string
  sensitivity?: number
  placeholder?: string
  nodeId: string
  bindingPath: NumberBindingPath
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
}>()

const { panels, dialogs } = useI18n()
const provider = useNumberBindingProvider()
const targets = computed<BindingTarget[]>(() => [{ nodeId, path: bindingPath }])

defineOptions({ inheritAttrs: false })
</script>

<template>
  <BindableValueRoot
    v-slot="binding"
    :provider="provider"
    :targets="targets"
    :value="typeof modelValue === 'number' ? modelValue : 0"
  >
    <NumberField
      v-bind="$attrs"
      :icon="icon"
      :label="label"
      :suffix="suffix"
      :sensitivity="sensitivity"
      :placeholder="placeholder"
      :model-value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      @update:model-value="emit('update:modelValue', $event)"
      @commit="(value: number, previous: number) => emit('commit', value, previous)"
    >
      <template v-if="$slots.icon" #icon>
        <slot name="icon" />
      </template>
      <template #suffix>
        <span :class="$slots['after-variable'] ? '' : 'pr-1'" class="flex items-center">
          <BoundVariableButton
            v-if="binding.state === 'bound'"
            :label="panels.detachVariable"
            @detach="binding.actions.unbind"
          />
          <VariablePickerPopover
            v-else
            :search-term="binding.searchTerm"
            :variables="binding.variables"
            :trigger-label="panels.applyVariable"
            :search-placeholder="dialogs.search"
            :empty-label="panels.noVariablesFound"
            :create-label="
              panels.createNumberVariable({
                value: typeof modelValue === 'number' ? Math.round(modelValue) : 0
              })
            "
            :create-name-placeholder="panels.variableName"
            :create-submit-label="panels.create"
            @update:search-term="binding.actions.setSearchTerm"
            @select="binding.actions.bind($event.id)"
            @create="binding.actions.create"
          />
        </span>
        <slot name="after-variable" />
      </template>
    </NumberField>
  </BindableValueRoot>
</template>
