import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { usePageList } from '@open-pencil/vue/PageList/usePageList'
import { useSelectionCapabilities } from '@open-pencil/vue/selection/useSelectionCapabilities'
import { useSelectionState } from '@open-pencil/vue/selection/useSelectionState'

import type { Component, ComputedRef } from 'vue'

/**
 * Stable command identifiers exposed by {@link useEditorCommands}.
 */
export type EditorCommandId =
  | 'edit.undo'
  | 'edit.redo'
  | 'selection.selectAll'
  | 'selection.duplicate'
  | 'selection.delete'
  | 'selection.group'
  | 'selection.ungroup'
  | 'selection.createComponent'
  | 'selection.createComponentSet'
  | 'selection.createInstance'
  | 'selection.detachInstance'
  | 'selection.goToMainComponent'
  | 'selection.wrapInAutoLayout'
  | 'selection.bringToFront'
  | 'selection.sendToBack'
  | 'selection.toggleVisibility'
  | 'selection.toggleLock'
  | 'selection.moveToPage'
  | 'view.zoom100'
  | 'view.zoomFit'
  | 'view.zoomSelection'

/**
 * Reactive editor command descriptor.
 */
export interface EditorCommand {
  /** Stable command id. */
  id: EditorCommandId
  /** Human-readable label for UI. */
  label: string
  /** Whether the command can currently run. */
  enabled: ComputedRef<boolean>
  /** Executes the command. */
  run: () => void
}

export interface EditorCommandMenuItem {
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  icon?: Component
}

export interface EditorCommandMenuSeparator {
  separator: true
}

export type EditorCommandMenuEntry = EditorCommandMenuItem | EditorCommandMenuSeparator

/**
 * Builds a command-oriented interface on top of the current editor.
 *
 * Use this composable when building menus, toolbars, keyboard handlers, or
 * any other UI that should talk in terms of commands instead of raw editor
 * method calls.
 */
export function useEditorCommands() {
  const editor = useEditor()
  const selection = useSelectionState()
  const capabilities = useSelectionCapabilities()
  const { pages } = usePageList()

  const commands: Record<EditorCommandId, EditorCommand> = {
    'edit.undo': {
      id: 'edit.undo',
      label: 'Undo',
      enabled: capabilities.canUndo,
      run: () => editor.undoAction()
    },
    'edit.redo': {
      id: 'edit.redo',
      label: 'Redo',
      enabled: capabilities.canRedo,
      run: () => editor.redoAction()
    },
    'selection.selectAll': {
      id: 'selection.selectAll',
      label: 'Select all',
      enabled: capabilities.canSelectAll,
      run: () => editor.selectAll()
    },
    'selection.duplicate': {
      id: 'selection.duplicate',
      label: 'Duplicate',
      enabled: capabilities.canDuplicate,
      run: () => editor.duplicateSelected()
    },
    'selection.delete': {
      id: 'selection.delete',
      label: 'Delete',
      enabled: capabilities.canDelete,
      run: () => editor.deleteSelected()
    },
    'selection.group': {
      id: 'selection.group',
      label: 'Group',
      enabled: capabilities.canGroup,
      run: () => editor.groupSelected()
    },
    'selection.ungroup': {
      id: 'selection.ungroup',
      label: 'Ungroup',
      enabled: capabilities.canUngroup,
      run: () => editor.ungroupSelected()
    },
    'selection.createComponent': {
      id: 'selection.createComponent',
      label: 'Create component',
      enabled: capabilities.canCreateComponent,
      run: () => editor.createComponentFromSelection()
    },
    'selection.createComponentSet': {
      id: 'selection.createComponentSet',
      label: 'Create component set',
      enabled: capabilities.canCreateComponentSet,
      run: () => editor.createComponentSetFromComponents()
    },
    'selection.createInstance': {
      id: 'selection.createInstance',
      label: 'Create instance',
      enabled: capabilities.canCreateInstance,
      run: () => {
        const node = selection.selectedNode.value
        if (node?.type === 'COMPONENT') editor.createInstanceFromComponent(node.id)
      }
    },
    'selection.detachInstance': {
      id: 'selection.detachInstance',
      label: 'Detach instance',
      enabled: capabilities.canDetachInstance,
      run: () => editor.detachInstance()
    },
    'selection.goToMainComponent': {
      id: 'selection.goToMainComponent',
      label: 'Go to main component',
      enabled: capabilities.canGoToMainComponent,
      run: () => editor.goToMainComponent()
    },
    'selection.wrapInAutoLayout': {
      id: 'selection.wrapInAutoLayout',
      label: 'Add auto layout',
      enabled: capabilities.canWrapInAutoLayout,
      run: () => editor.wrapInAutoLayout()
    },
    'selection.bringToFront': {
      id: 'selection.bringToFront',
      label: 'Bring to front',
      enabled: capabilities.canBringToFront,
      run: () => editor.bringToFront()
    },
    'selection.sendToBack': {
      id: 'selection.sendToBack',
      label: 'Send to back',
      enabled: capabilities.canSendToBack,
      run: () => editor.sendToBack()
    },
    'selection.toggleVisibility': {
      id: 'selection.toggleVisibility',
      label: 'Toggle visibility',
      enabled: capabilities.canToggleVisibility,
      run: () => editor.toggleVisibility()
    },
    'selection.toggleLock': {
      id: 'selection.toggleLock',
      label: 'Toggle lock',
      enabled: capabilities.canToggleLock,
      run: () => editor.toggleLock()
    },
    'selection.moveToPage': {
      id: 'selection.moveToPage',
      label: 'Move to page',
      enabled: capabilities.canMoveToPage,
      run: () => {
        const targetPage = otherPages.value[0]
        if (targetPage) moveSelectionToPage(targetPage.id)
      }
    },
    'view.zoom100': {
      id: 'view.zoom100',
      label: 'Zoom to 100%',
      enabled: computed(() => true),
      run: () => editor.zoomTo100()
    },
    'view.zoomFit': {
      id: 'view.zoomFit',
      label: 'Zoom to fit',
      enabled: computed(() => true),
      run: () => editor.zoomToFit()
    },
    'view.zoomSelection': {
      id: 'view.zoomSelection',
      label: 'Zoom to selection',
      enabled: capabilities.canZoomToSelection,
      run: () => editor.zoomToSelection()
    }
  }

  const otherPages = computed(() =>
    pages.value.filter((page) => page.id !== editor.state.currentPageId)
  )

  function getCommand(id: EditorCommandId) {
    return commands[id]
  }

  function runCommand(id: EditorCommandId) {
    const command = commands[id]
    if (command.enabled.value) command.run()
  }

  function moveSelectionToPage(pageId: string) {
    if (!capabilities.canMoveToPage.value) return
    editor.moveToPage(pageId)
  }

  function menuItem(id: EditorCommandId, shortcut?: string): EditorCommandMenuItem {
    const command = getCommand(id)
    return {
      label: command.label,
      shortcut,
      get disabled() {
        return !command.enabled.value
      },
      action: () => runCommand(id)
    }
  }

  return {
    commands,
    otherPages,
    getCommand,
    runCommand,
    moveSelectionToPage,
    menuItem
  }
}
