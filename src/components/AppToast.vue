<script setup lang="ts">
import { ToastProvider, ToastRoot, ToastDescription, ToastViewport } from 'reka-ui'

import { toast } from '@/composables/use-toast'
</script>

<template>
  <ToastProvider :duration="toast.TOAST_DURATION" swipe-direction="up">
    <ToastRoot
      v-for="t in toast.toasts.value"
      :key="t.id"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1 data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)] data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform"
      :class="t.variant === 'error' ? 'bg-red-600' : 'bg-blue-600'"
      @update:open="
        (open) => {
          if (!open) toast.remove(t.id)
        }
      "
    >
      <icon-lucide-check v-if="t.variant === 'default'" class="size-3 shrink-0" />
      <icon-lucide-alert-triangle v-else class="size-3 shrink-0" />
      <ToastDescription>{{ t.message }}</ToastDescription>
    </ToastRoot>

    <ToastViewport
      class="fixed top-2 left-1/2 z-[9999] flex -translate-x-1/2 flex-col items-center gap-1.5"
    />
  </ToastProvider>
</template>
