import { nextTick, ref } from 'vue'

export function useInlineRename(onCommit: (id: string, newName: string) => void) {
  const editingId = ref<string | null>(null)
  let originalName = ''

  function start(id: string, currentName: string) {
    editingId.value = id
    originalName = currentName
  }

  async function focusInput(input: HTMLInputElement | null) {
    await nextTick()
    input?.focus()
    input?.select()
  }

  function commit(id: string, input: HTMLInputElement) {
    if (editingId.value !== id) return
    const value = input.value.trim()
    if (value && value !== originalName) {
      onCommit(id, value)
    }
    editingId.value = null
  }

  function cancel() {
    editingId.value = null
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      ;(e.target as HTMLInputElement).blur()
      return
    }

    if (e.key === 'Escape') {
      cancel()
    }
  }

  return { editingId, start, focusInput, commit, cancel, onKeydown }
}
