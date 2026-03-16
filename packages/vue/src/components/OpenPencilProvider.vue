<script setup lang="ts">
import type { Editor } from '@open-pencil/core/editor'

import { provideEditor } from '../context'

const props = defineProps<{ editor: Editor }>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
