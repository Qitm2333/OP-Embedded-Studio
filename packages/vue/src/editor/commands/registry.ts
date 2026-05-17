import type { EditorCommandId } from './types'

export interface EditorCommandMetadata {
  shortcut?: string
  keybinding?: string | string[]
  contextTestId?: string
}

export const EDITOR_COMMAND_METADATA = {
  'edit.undo': { shortcut: '⌘Z', keybinding: '$mod+KeyZ' },
  'edit.redo': { shortcut: '⇧⌘Z', keybinding: ['$mod+Shift+KeyZ', '$mod+KeyY'] },
  'selection.selectAll': { shortcut: '⌘A', keybinding: '$mod+KeyA' },
  'selection.duplicate': {
    shortcut: '⌘D',
    keybinding: '$mod+KeyD',
    contextTestId: 'context-duplicate'
  },
  'selection.delete': { shortcut: '⌫', contextTestId: 'context-delete' },
  'selection.group': { shortcut: '⌘G', keybinding: '$mod+KeyG', contextTestId: 'context-group' },
  'selection.ungroup': { shortcut: '⇧⌘G', keybinding: '$mod+Shift+KeyG' },
  'selection.createComponent': {
    shortcut: '⌥⌘K',
    keybinding: '$mod+Alt+KeyK',
    contextTestId: 'context-create-component'
  },
  'selection.createComponentSet': { shortcut: '⇧⌘K', keybinding: '$mod+Shift+KeyK' },
  'selection.detachInstance': { shortcut: '⌥⌘B', keybinding: '$mod+Alt+KeyB' },
  'selection.goToMainComponent': {},
  'selection.createInstance': {},
  'selection.wrapInAutoLayout': { shortcut: '⇧A', keybinding: 'Shift+KeyA' },
  'selection.bringToFront': {
    shortcut: ']',
    keybinding: 'BracketRight',
    contextTestId: 'context-bring-to-front'
  },
  'selection.sendToBack': {
    shortcut: '[',
    keybinding: 'BracketLeft',
    contextTestId: 'context-send-to-back'
  },
  'selection.toggleVisibility': {
    shortcut: '⇧⌘H',
    keybinding: '$mod+Shift+KeyH',
    contextTestId: 'context-toggle-visibility'
  },
  'selection.toggleLock': {
    shortcut: '⇧⌘L',
    keybinding: '$mod+Shift+KeyL',
    contextTestId: 'context-toggle-lock'
  },
  'selection.moveToPage': {},
  'view.zoom100': { keybinding: '$mod+Digit0' },
  'view.zoomFit': { keybinding: ['$mod+Digit1', 'Shift+Digit1'] },
  'view.zoomSelection': { keybinding: ['$mod+Digit2', 'Shift+Digit2'] }
} satisfies Record<EditorCommandId, EditorCommandMetadata>

export function editorCommandMetadata(id: EditorCommandId): EditorCommandMetadata {
  return EDITOR_COMMAND_METADATA[id]
}
