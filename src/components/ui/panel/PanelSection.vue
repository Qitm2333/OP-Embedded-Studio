<script lang="ts">
import type { VNode } from 'vue'
import type { ClassValue } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import type { PanelSectionTheme } from '@/theme/panel/section'

export interface PanelSectionProps {
  label: string
  class?: ClassValue
  ui?: ComponentUI<PanelSectionTheme>
}

export interface PanelSectionSlots {
  default(): VNode[]
  actions?(): VNode[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import theme from '@/theme/panel/section'

const { label, class: className, ui } = defineProps<PanelSectionProps>()
const slots = defineSlots<PanelSectionSlots>()

const styles = computed(() => tv(theme)({ actions: Boolean(slots.actions) }))
</script>

<template>
  <section data-slot="root" :class="styles.root({ class: [ui?.root, className] })">
    <div data-slot="header" :class="styles.header({ class: ui?.header })">
      <h3 data-slot="title" :class="styles.title({ class: ui?.title })">{{ label }}</h3>
      <div v-if="slots.actions" data-slot="actions" :class="styles.actions({ class: ui?.actions })">
        <slot name="actions" />
      </div>
    </div>
    <div data-slot="body" :class="styles.body({ class: ui?.body })">
      <slot />
    </div>
  </section>
</template>
