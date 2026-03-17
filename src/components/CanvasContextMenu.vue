<script setup lang="ts">
import { ContextMenuRoot, ContextMenuTrigger, ContextMenuPortal } from 'reka-ui'

import NodeContextMenuContent from './NodeContextMenuContent.vue'

const { onContextMenu } = defineProps<{
  onContextMenu?: (e: MouseEvent) => void
}>()
</script>

<template>
  <ContextMenuRoot :modal="false">
    <ContextMenuTrigger as-child @contextmenu="onContextMenu">
      <slot />
    </ContextMenuTrigger>

    <ContextMenuPortal>
      <NodeContextMenuContent />
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
