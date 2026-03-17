<script setup lang="ts">
import { useEditor, useSceneComputed } from '@open-pencil/vue'

const store = useEditor()
const emit = defineEmits<{ openDialog: [] }>()

const collectionCount = useSceneComputed(() => store.getCollectionCount())

const variableCount = useSceneComputed(() => store.getVariableCount())
</script>

<template>
  <div data-test-id="variables-section" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="text-[11px] font-medium text-surface">Variables</label>
      <button
        data-test-id="variables-section-open"
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface"
        title="Open variables"
        @click="emit('openDialog')"
      >
        <icon-lucide-settings-2 class="size-3.5" />
      </button>
    </div>
    <div v-if="variableCount > 0" class="mt-1 text-[11px] text-muted">
      {{ variableCount }} variable{{ variableCount !== 1 ? 's' : '' }} in
      {{ collectionCount }} collection{{ collectionCount !== 1 ? 's' : '' }}
    </div>
    <div v-else class="mt-1 text-[11px] text-muted">No local variables</div>
  </div>
</template>
