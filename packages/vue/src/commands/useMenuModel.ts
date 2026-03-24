import { computed } from 'vue'

import { useEditorCommands } from '@open-pencil/vue/commands/useEditorCommands'
import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useSelectionState } from '@open-pencil/vue/selection/useSelectionState'

export interface MenuActionNode {
  separator?: false
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  sub?: MenuEntry[]
}

export interface MenuSeparatorNode {
  separator: true
}

export type MenuEntry = MenuActionNode | MenuSeparatorNode

export function useMenuModel() {
  const editor = useEditor()
  const { menuItem: commandMenuItem, otherPages, moveSelectionToPage } = useEditorCommands()
  const { hasSelection, isGroup, isInstance, isComponent, canCreateComponentSet, selectedNode } =
    useSelectionState()

  const editMenu = computed<MenuEntry[]>(() => [
    commandMenuItem('edit.undo'),
    commandMenuItem('edit.redo'),
    { separator: true },
    commandMenuItem('selection.duplicate'),
    commandMenuItem('selection.delete'),
    { separator: true },
    commandMenuItem('selection.selectAll')
  ])

  const viewMenu = computed<MenuEntry[]>(() => [
    commandMenuItem('view.zoom100'),
    commandMenuItem('view.zoomFit'),
    commandMenuItem('view.zoomSelection')
  ])

  const objectMenu = computed<MenuEntry[]>(() => [
    commandMenuItem('selection.group'),
    commandMenuItem('selection.ungroup'),
    { separator: true },
    commandMenuItem('selection.createComponent'),
    commandMenuItem('selection.createComponentSet'),
    commandMenuItem('selection.detachInstance'),
    { separator: true },
    commandMenuItem('selection.bringToFront'),
    commandMenuItem('selection.sendToBack')
  ])

  const arrangeMenu = computed<MenuEntry[]>(() => [commandMenuItem('selection.wrapInAutoLayout')])

  const appMenu = computed(() => [
    { label: 'Edit', items: editMenu.value },
    { label: 'View', items: viewMenu.value },
    { label: 'Object', items: objectMenu.value },
    { label: 'Arrange', items: arrangeMenu.value }
  ])

  const canvasMenu = computed<MenuEntry[]>(() => {
    const moveToPageSubmenu: MenuEntry[] = otherPages.value.map((page) => ({
      label: page.name,
      action: () => moveSelectionToPage(page.id)
    }))

    return [
      { ...commandMenuItem('selection.duplicate', '⌘D'), label: 'Duplicate' },
      commandMenuItem('selection.delete', '⌫'),
      { separator: true },
      ...(moveToPageSubmenu.length > 0 && hasSelection.value
        ? [{ label: 'Move to page', sub: moveToPageSubmenu } satisfies MenuActionNode]
        : []),
      commandMenuItem('selection.bringToFront', ']'),
      commandMenuItem('selection.sendToBack', '['),
      { separator: true },
      commandMenuItem('selection.group', '⌘G'),
      ...(isGroup.value ? [commandMenuItem('selection.ungroup', '⇧⌘G')] : []),
      ...(hasSelection.value ? [commandMenuItem('selection.wrapInAutoLayout', '⇧A')] : []),
      { separator: true },
      commandMenuItem('selection.createComponent', '⌥⌘K'),
      ...(canCreateComponentSet.value
        ? [commandMenuItem('selection.createComponentSet', '⇧⌘K')]
        : []),
      ...(isComponent.value && selectedNode.value
        ? [
            {
              label: 'Create instance',
              action: () => commandMenuItem('selection.createInstance').action?.(),
              disabled: !commandMenuItem('selection.createInstance').disabled
            } satisfies MenuActionNode
          ]
        : []),
      ...(isInstance.value ? [commandMenuItem('selection.goToMainComponent')] : []),
      ...(isInstance.value ? [commandMenuItem('selection.detachInstance', '⌥⌘B')] : []),
      ...(hasSelection.value
        ? [
            { separator: true } as MenuSeparatorNode,
            commandMenuItem('selection.toggleVisibility', '⇧⌘H'),
            commandMenuItem('selection.toggleLock', '⇧⌘L')
          ]
        : [])
    ]
  })

  const selectionLabelMenu = computed(() => ({
    visibility: (editor.getSelectedNode()?.visible ?? true) ? 'Hide' : 'Show',
    lock: (editor.getSelectedNode()?.locked ?? false) ? 'Unlock' : 'Lock'
  }))

  return {
    appMenu,
    canvasMenu,
    selectionLabelMenu
  }
}
