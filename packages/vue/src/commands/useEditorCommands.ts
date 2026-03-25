import { useStore } from '@nanostores/vue'
import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { commandMessages } from '@open-pencil/vue/i18n'
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

  const t = useStore(commandMessages)

  const commands: Record<EditorCommandId, EditorCommand> = {
    'edit.undo': {
      id: 'edit.undo',
      get label() {
        return t.value.undo
      },
      enabled: capabilities.canUndo,
      run: () => editor.undoAction()
    },
    'edit.redo': {
      id: 'edit.redo',
      get label() {
        return t.value.redo
      },
      enabled: capabilities.canRedo,
      run: () => editor.redoAction()
    },
    'selection.selectAll': {
      id: 'selection.selectAll',
      get label() {
        return t.value.selectAll
      },
      enabled: capabilities.canSelectAll,
      run: () => editor.selectAll()
    },
    'selection.duplicate': {
      id: 'selection.duplicate',
      get label() {
        return t.value.duplicate
      },
      enabled: capabilities.canDuplicate,
      run: () => editor.duplicateSelected()
    },
    'selection.delete': {
      id: 'selection.delete',
      get label() {
        return t.value.delete
      },
      enabled: capabilities.canDelete,
      run: () => editor.deleteSelected()
    },
    'selection.group': {
      id: 'selection.group',
      get label() {
        return t.value.group
      },
      enabled: capabilities.canGroup,
      run: () => editor.groupSelected()
    },
    'selection.ungroup': {
      id: 'selection.ungroup',
      get label() {
        return t.value.ungroup
      },
      enabled: capabilities.canUngroup,
      run: () => editor.ungroupSelected()
    },
    'selection.createComponent': {
      id: 'selection.createComponent',
      get label() {
        return t.value.createComponent
      },
      enabled: capabilities.canCreateComponent,
      run: () => editor.createComponentFromSelection()
    },
    'selection.createComponentSet': {
      id: 'selection.createComponentSet',
      get label() {
        return t.value.createComponentSet
      },
      enabled: capabilities.canCreateComponentSet,
      run: () => editor.createComponentSetFromComponents()
    },
    'selection.createInstance': {
      id: 'selection.createInstance',
      get label() {
        return t.value.createInstance
      },
      enabled: capabilities.canCreateInstance,
      run: () => {
        const node = selection.selectedNode.value
        if (node?.type === 'COMPONENT') editor.createInstanceFromComponent(node.id)
      }
    },
    'selection.detachInstance': {
      id: 'selection.detachInstance',
      get label() {
        return t.value.detachInstance
      },
      enabled: capabilities.canDetachInstance,
      run: () => editor.detachInstance()
    },
    'selection.goToMainComponent': {
      id: 'selection.goToMainComponent',
      get label() {
        return t.value.goToMainComponent
      },
      enabled: capabilities.canGoToMainComponent,
      run: () => editor.goToMainComponent()
    },
    'selection.wrapInAutoLayout': {
      id: 'selection.wrapInAutoLayout',
      get label() {
        return t.value.addAutoLayout
      },
      enabled: capabilities.canWrapInAutoLayout,
      run: () => editor.wrapInAutoLayout()
    },
    'selection.bringToFront': {
      id: 'selection.bringToFront',
      get label() {
        return t.value.bringToFront
      },
      enabled: capabilities.canBringToFront,
      run: () => editor.bringToFront()
    },
    'selection.sendToBack': {
      id: 'selection.sendToBack',
      get label() {
        return t.value.sendToBack
      },
      enabled: capabilities.canSendToBack,
      run: () => editor.sendToBack()
    },
    'selection.toggleVisibility': {
      id: 'selection.toggleVisibility',
      get label() {
        return t.value.toggleVisibility
      },
      enabled: capabilities.canToggleVisibility,
      run: () => editor.toggleVisibility()
    },
    'selection.toggleLock': {
      id: 'selection.toggleLock',
      get label() {
        return t.value.toggleLock
      },
      enabled: capabilities.canToggleLock,
      run: () => editor.toggleLock()
    },
    'selection.moveToPage': {
      id: 'selection.moveToPage',
      get label() {
        return t.value.moveToPage
      },
      enabled: capabilities.canMoveToPage,
      run: () => {
        const targetPage = otherPages.value[0]
        if (targetPage) moveSelectionToPage(targetPage.id)
      }
    },
    'view.zoom100': {
      id: 'view.zoom100',
      get label() {
        return t.value.zoomTo100
      },
      enabled: computed(() => true),
      run: () => editor.zoomTo100()
    },
    'view.zoomFit': {
      id: 'view.zoomFit',
      get label() {
        return t.value.zoomToFit
      },
      enabled: computed(() => true),
      run: () => editor.zoomToFit()
    },
    'view.zoomSelection': {
      id: 'view.zoomSelection',
      get label() {
        return t.value.zoomToSelection
      },
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
