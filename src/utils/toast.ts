import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

export type ToastVariant = 'default' | 'warning' | 'error'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

const TOAST_DURATION = 3000

const toasts = ref<Toast[]>([])
let nextId = 0
let errorHandlersInitialized = false

function info(message: string) {
  toasts.value.push({ id: ++nextId, message, variant: 'default' })
}

function warning(message: string) {
  toasts.value.push({ id: ++nextId, message, variant: 'warning' })
}

function error(message: string) {
  toasts.value.push({ id: ++nextId, message, variant: 'error' })
}

function remove(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function setupGlobalErrorHandler() {
  if (errorHandlersInitialized) return
  errorHandlersInitialized = true

  useEventListener(window, 'error', (e) => {
    error(e.message || 'An unexpected error occurred')
  })
  useEventListener(window, 'unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    error(msg || 'An unexpected error occurred')
  })
}

export const toast = {
  info,
  warning,
  error,
  remove,
  toasts,
  setupGlobalErrorHandler,
  TOAST_DURATION
}
