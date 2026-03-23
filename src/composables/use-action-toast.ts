import { ACTION_TOAST_DURATION } from '@/constants'
import { useEditorStore } from '@/stores/editor'

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function useActionToast() {
  const store = useEditorStore()

  function showActionToast(label: string) {
    store.state.actionToast = label
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      store.state.actionToast = null
    }, ACTION_TOAST_DURATION)
  }

  return {
    showActionToast
  }
}
