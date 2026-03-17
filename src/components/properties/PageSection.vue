<script setup lang="ts">
import ColorInput from '@/components/ColorInput.vue'
import { sectionWrapper } from '@/components/ui/section'
import { PageControlsRoot } from '@open-pencil/vue'
</script>

<template>
  <PageControlsRoot v-slot="{ pageColor, setPageColor }">
    <div data-test-id="page-section" :class="sectionWrapper()">
      <label class="mb-1.5 block text-[11px] text-muted">Page</label>
      <ColorInput :color="pageColor" editable @update="setPageColor" />
    </div>
  </PageControlsRoot>
</template>
