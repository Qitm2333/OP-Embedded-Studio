<script setup lang="ts">
import { onMounted } from 'vue'

import AppToast from '@/components/AppToast.vue'
import { toast } from '@/composables/use-toast'

onMounted(() => {
  toast.setupGlobalErrorHandler()
})
</script>

<template>
  <RouterView />
  <AppToast />
</template>
