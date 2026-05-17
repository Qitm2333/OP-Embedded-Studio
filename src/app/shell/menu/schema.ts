import type { EditorCommandId } from '@open-pencil/vue'

export type AppMenuTarget = 'all' | 'browser' | 'native'

export interface AppMenuActionItem {
  type?: 'item'
  id: string
  label: string
  shortcut?: string
  accelerator?: string
  command?: EditorCommandId
  checkbox?: boolean
  target?: AppMenuTarget
  sub?: AppMenuEntry[]
}

export interface AppMenuSeparatorItem {
  type: 'separator'
  target?: AppMenuTarget
}

export type AppMenuEntry = AppMenuActionItem | AppMenuSeparatorItem

export interface AppMenuGroupSchema {
  label: string
  target?: AppMenuTarget
  items: AppMenuEntry[]
}

export const APP_MENU_SCHEMA = [
  {
    label: 'File',
    items: [
      { id: 'new', label: 'New', shortcut: 'MOD+N' },
      { id: 'open', label: 'Open…', shortcut: 'MOD+O' },
      { type: 'separator' },
      { id: 'save', label: 'Save', shortcut: 'MOD+S' },
      { id: 'save-as', label: 'Save As…', shortcut: 'MOD+SHIFT+S' },
      { type: 'separator' },
      {
        id: 'export-selection',
        label: 'Export Selection',
        shortcut: 'MOD+SHIFT+E',
        sub: [
          { id: 'export-png', label: 'PNG' },
          { id: 'export-svg', label: 'SVG' },
          { id: 'export-fig', label: '.fig' }
        ]
      },
      { type: 'separator' },
      { id: 'autosave', label: 'Autosave', checkbox: true },
      { id: 'close', label: 'Close Tab', shortcut: 'MOD+W' }
    ]
  },
  {
    label: 'Edit',
    items: [
      {
        id: 'edit.undo',
        label: 'Undo',
        shortcut: 'MOD+Z',
        command: 'edit.undo'
      },
      {
        id: 'edit.redo',
        label: 'Redo',
        shortcut: 'MOD+SHIFT+Z',
        command: 'edit.redo'
      },
      { type: 'separator' },
      { id: 'copy', label: 'Copy', shortcut: 'MOD+C' },
      { id: 'cut', label: 'Cut', shortcut: 'MOD+X' },
      { id: 'paste', label: 'Paste', shortcut: 'MOD+V' },
      {
        id: 'selection.duplicate',
        label: 'Duplicate',
        shortcut: 'MOD+D',
        command: 'selection.duplicate'
      },
      {
        id: 'selection.delete',
        label: 'Delete',
        shortcut: '⌫',
        command: 'selection.delete'
      },
      { type: 'separator' },
      {
        id: 'selection.selectAll',
        label: 'Select All',
        shortcut: 'MOD+A',
        command: 'selection.selectAll'
      }
    ]
  },
  {
    label: 'View',
    items: [
      {
        id: 'view.zoom100',
        label: 'Zoom to 100%',
        shortcut: 'MOD+0',
        command: 'view.zoom100'
      },
      {
        id: 'view.zoomFit',
        label: 'Zoom to Fit',
        shortcut: 'MOD+1',
        command: 'view.zoomFit'
      },
      {
        id: 'view.zoomSelection',
        label: 'Zoom to Selection',
        shortcut: 'MOD+2',
        command: 'view.zoomSelection'
      },
      { id: 'zoom-in', label: 'Zoom In', shortcut: 'MOD+=' },
      { id: 'zoom-out', label: 'Zoom Out', shortcut: 'MOD+-' },
      { type: 'separator' },
      {
        id: 'theme',
        label: 'Theme',
        sub: [
          { id: 'theme-light', label: 'Light', checkbox: true },
          { id: 'theme-dark', label: 'Dark', checkbox: true },
          { id: 'theme-auto', label: 'Auto', checkbox: true }
        ]
      },
      { id: 'language', label: 'Language', target: 'browser' },
      { type: 'separator' },
      { id: 'toggle-ui', label: 'Toggle UI', shortcut: 'MOD+\\' },
      { id: 'profiler', label: 'Profiler', checkbox: true, target: 'browser' },
      {
        id: 'dev-tools',
        label: 'Developer Tools',
        target: 'native'
      }
    ]
  },
  {
    label: 'Object',
    items: [
      {
        id: 'selection.group',
        label: 'Group Selection',
        shortcut: 'MOD+G',
        command: 'selection.group'
      },
      {
        id: 'selection.ungroup',
        label: 'Ungroup Selection',
        shortcut: 'MOD+SHIFT+G',
        command: 'selection.ungroup'
      },
      { type: 'separator' },
      {
        id: 'selection.createComponent',
        label: 'Create Component',
        shortcut: 'MOD+ALT+K',
        command: 'selection.createComponent'
      },
      {
        id: 'selection.createComponentSet',
        label: 'Create Component Set',
        command: 'selection.createComponentSet'
      },
      {
        id: 'selection.detachInstance',
        label: 'Detach Instance',
        command: 'selection.detachInstance'
      },
      { type: 'separator' },
      {
        id: 'selection.bringToFront',
        label: 'Bring to Front',
        shortcut: ']',
        command: 'selection.bringToFront'
      },
      {
        id: 'selection.sendToBack',
        label: 'Send to Back',
        shortcut: '[',
        command: 'selection.sendToBack'
      }
    ]
  },
  {
    label: 'Text',
    items: [
      { id: 'text.bold', label: 'Bold', shortcut: 'MOD+B' },
      { id: 'text.italic', label: 'Italic', shortcut: 'MOD+I' },
      { id: 'text.underline', label: 'Underline', shortcut: 'MOD+U' }
    ]
  },
  {
    label: 'Arrange',
    items: [
      {
        id: 'selection.wrapInAutoLayout',
        label: 'Wrap in Auto Layout',
        shortcut: 'SHIFT+A',
        command: 'selection.wrapInAutoLayout'
      },
      { type: 'separator' },
      { id: 'align-left', label: 'Align Left', shortcut: 'ALT+A' },
      { id: 'align-center', label: 'Align Center', shortcut: 'ALT+H' },
      { id: 'align-right', label: 'Align Right', shortcut: 'ALT+D' },
      { type: 'separator' },
      { id: 'align-top', label: 'Align Top', shortcut: 'ALT+W' },
      { id: 'align-middle', label: 'Align Middle', shortcut: 'ALT+V' },
      { id: 'align-bottom', label: 'Align Bottom', shortcut: 'ALT+S' }
    ]
  }
] satisfies AppMenuGroupSchema[]
