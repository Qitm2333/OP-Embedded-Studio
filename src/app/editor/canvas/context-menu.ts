import { computed, type Ref } from 'vue'

import { formatShortcut, type Editor, type MenuEntry } from '@open-pencil/vue'

import { COPY_AS_PNG_SHORTCUT } from '@/app/editor/canvas/menu-actions'
import type { createCanvasMenuActions } from '@/app/editor/canvas/menu-actions'

const STATIC_SELECTION_COMMAND_IDS = new Set(['selection.duplicate', 'selection.delete'])

type CanvasMenuActions = ReturnType<typeof createCanvasMenuActions>

type CanvasCopyLabels = {
  copyPasteAs: string
  copyAsText: string
  copyAsSVG: string
  copyAsPNG: string
  copyAsJSX: string
  copyNodeId: string
  copyXPath: string
}

function withoutStaticSelectionCommands(entries: readonly MenuEntry[]): MenuEntry[] {
  return entries.filter((entry) => {
    if (entry.separator) return true
    return !entry.id || !STATIC_SELECTION_COMMAND_IDS.has(entry.id)
  })
}

function runAsync(action: () => Promise<void>) {
  return () => {
    void action()
  }
}

function copyPasteAsEntry(
  editor: Editor,
  actions: CanvasMenuActions,
  labels: CanvasCopyLabels
): MenuEntry {
  return {
    label: labels.copyPasteAs,
    testId: 'context-copy-paste-as',
    sub: [
      {
        label: labels.copyAsText,
        action: runAsync(() => actions.clipboardWrite(editor.copySelectionAsText(actions.ids()), 'text'))
      },
      {
        label: labels.copyAsSVG,
        testId: 'context-copy-as-svg',
        action: runAsync(() => actions.clipboardWrite(editor.copySelectionAsSVG(actions.ids()), 'SVG'))
      },
      {
        label: labels.copyAsPNG,
        shortcut: formatShortcut(COPY_AS_PNG_SHORTCUT),
        action: runAsync(actions.copyAsPNG)
      },
      {
        label: labels.copyAsJSX,
        testId: 'context-copy-as-jsx',
        action: runAsync(() => actions.clipboardWrite(editor.copySelectionAsJSX(actions.ids()), 'JSX'))
      },
      { label: labels.copyNodeId, action: runAsync(actions.copyNodeId) },
      { label: labels.copyXPath, action: runAsync(actions.copyXPath) }
    ]
  }
}

export function useCanvasContextMenu(
  baseEntries: Ref<MenuEntry[]>,
  hasSelection: Ref<boolean>,
  editor: Editor,
  actions: CanvasMenuActions,
  labels: Ref<CanvasCopyLabels>
) {
  return computed<MenuEntry[]>(() => {
    const entries = withoutStaticSelectionCommands(baseEntries.value)
    if (!hasSelection.value) return entries
    return [...entries, { separator: true }, copyPasteAsEntry(editor, actions, labels.value)]
  })
}
