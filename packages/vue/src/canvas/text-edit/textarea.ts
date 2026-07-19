import { watch } from 'vue'
import type { Ref, ShallowRef } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

export function createHiddenTextArea() {
  const textarea = document.createElement('textarea')
  textarea.setAttribute('aria-hidden', 'true')
  textarea.tabIndex = -1
  textarea.className = 'fixed h-px w-px opacity-0'
  textarea.style.left = '0px'
  textarea.style.top = '0px'
  document.body.appendChild(textarea)
  return textarea
}

function updateTextAreaPosition(
  textarea: HTMLTextAreaElement,
  canvas: HTMLCanvasElement | null,
  store: Editor,
  fallbackCaretX = 0
): number {
  const nodeId = store.state.editingTextId
  if (!nodeId || !canvas) return fallbackCaretX

  const node = store.graph.getNode(nodeId)
  if (!node) return fallbackCaretX

  const caret = store.textEditor?.getCaretRect()
  const caretX = caret?.x ?? fallbackCaretX
  const nodePosition = store.graph.getAbsolutePosition(nodeId)
  const canvasRect = canvas.getBoundingClientRect()
  const left = canvasRect.left + store.state.panX + (nodePosition.x + caretX) * store.state.zoom
  const top = canvasRect.top + store.state.panY + nodePosition.y * store.state.zoom
  const nextLeft = `${Math.round(left)}px`
  const nextTop = `${Math.round(top)}px`

  if (textarea.style.left !== nextLeft) textarea.style.left = nextLeft
  if (textarea.style.top !== nextTop) textarea.style.top = nextTop
  return caretX
}

export function focusTextAreaOnCanvasPointerDown(
  textareaRef: ShallowRef<HTMLTextAreaElement | null>,
  store: Editor
) {
  if (store.state.editingTextId && textareaRef.value) {
    requestAnimationFrame(() => textareaRef.value?.focus())
  }
}

export function useTextEditingSession({
  store,
  canvasRef,
  textareaRef,
  resetBlink,
  stopBlink,
  resetComposition,
  isComposing
}: {
  store: Editor
  canvasRef: Ref<HTMLCanvasElement | null>
  textareaRef: ShallowRef<HTMLTextAreaElement | null>
  resetBlink: () => void
  stopBlink: () => void
  resetComposition: () => void
  isComposing?: () => boolean
}) {
  watch(
    () => store.state.editingTextId,
    (id, _, onCleanup) => {
      if (id) {
        const el = createHiddenTextArea()
        textareaRef.value = el
        let frame = 0
        let lastCaretX = 0
        const updatePosition = () => {
          if (!isComposing?.()) {
            lastCaretX = updateTextAreaPosition(el, canvasRef.value, store, lastCaretX)
          }
          frame = requestAnimationFrame(updatePosition)
        }
        updatePosition()
        el.focus()
        resetBlink()

        onCleanup(() => {
          cancelAnimationFrame(frame)
          stopBlink()
          el.remove()
          textareaRef.value = null
          resetComposition()
        })
      }
    }
  )
}
