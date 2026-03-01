import { ref } from 'vue'

export type ToastVariant = 'default' | 'error'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

const TOAST_DURATION = 3000

const toasts = ref<Toast[]>([])
let nextId = 0

function show(message: string, variant: ToastVariant = 'default') {
  toasts.value.push({ id: ++nextId, message, variant })
}

function remove(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function setupGlobalErrorHandler() {
  window.addEventListener('error', (e) => {
    show(e.message || 'An unexpected error occurred', 'error')
  })
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    show(msg || 'An unexpected error occurred', 'error')
  })
}

export const toast = { show, remove, toasts, setupGlobalErrorHandler, TOAST_DURATION }
