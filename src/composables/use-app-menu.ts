import { computed } from 'vue'

import { useEditorStore } from '@/stores/editor'
import { useEditorCommands, useMenuModel } from '@open-pencil/vue'

export function useAppMenu(mod: string) {
  const store = useEditorStore()
  const { menuItem: commandMenuItem } = useEditorCommands()
  const { appMenu } = useMenuModel()

  const textMenu = [
    { label: 'Bold', shortcut: `${mod}B` },
    { label: 'Italic', shortcut: `${mod}I` },
    { label: 'Underline', shortcut: `${mod}U` }
  ]

  const fileMenu = [
    {
      label: 'New',
      shortcut: `${mod}N`,
      action: () => import('@/stores/tabs').then((m) => m.createTab())
    },
    { label: 'Open…', shortcut: `${mod}O` },
    { separator: true as const },
    { label: 'Save', shortcut: `${mod}S` },
    { label: 'Save as…', shortcut: `${mod}⇧S` },
    { separator: true as const },
    {
      label: 'Export selection…',
      shortcut: `${mod}⇧E`,
      disabled: store.state.selectedIds.size === 0
    },
    { separator: true as const },
    {
      label: 'Auto-save to local file',
      get checked() {
        return store.state.autosaveEnabled
      },
      onCheckedChange: (value: boolean) => {
        store.state.autosaveEnabled = value
      }
    }
  ]

  const topMenus = computed(() => [
    { label: 'File', items: fileMenu },
    ...appMenu.value.map((menu) => {
      if (menu.label === 'View') {
        return {
          label: 'View',
          items: [
            commandMenuItem('view.zoom100', `${mod}0`),
            commandMenuItem('view.zoomFit', `${mod}1`),
            commandMenuItem('view.zoomSelection', `${mod}2`),
            {
              label: 'Zoom in',
              shortcut: `${mod}=`,
              action: () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2)
            },
            {
              label: 'Zoom out',
              shortcut: `${mod}-`,
              action: () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2)
            },
            { separator: true as const },
            {
              label: 'Performance profiler',
              get checked() {
                return store.renderer?.profiler.hudVisible ?? false
              },
              onCheckedChange: () => {
                store.toggleProfiler()
              }
            }
          ]
        }
      }

      if (menu.label === 'Edit') {
        return {
          label: 'Edit',
          items: [
            commandMenuItem('edit.undo', `${mod}Z`),
            commandMenuItem('edit.redo', `${mod}⇧Z`),
            { separator: true as const },
            { label: 'Copy', shortcut: `${mod}C` },
            { label: 'Paste', shortcut: `${mod}V` },
            commandMenuItem('selection.duplicate', `${mod}D`),
            commandMenuItem('selection.delete', '⌫'),
            { separator: true as const },
            commandMenuItem('selection.selectAll', `${mod}A`)
          ]
        }
      }

      if (menu.label === 'Object') {
        return {
          label: 'Object',
          items: [
            commandMenuItem('selection.group', `${mod}G`),
            commandMenuItem('selection.ungroup', `${mod}⇧G`),
            { separator: true as const },
            commandMenuItem('selection.createComponent', `${mod}⌥K`),
            commandMenuItem('selection.createComponentSet'),
            commandMenuItem('selection.detachInstance'),
            { separator: true as const },
            commandMenuItem('selection.bringToFront', ']'),
            commandMenuItem('selection.sendToBack', '[')
          ]
        }
      }

      if (menu.label === 'Arrange') {
        return {
          label: 'Arrange',
          items: [
            commandMenuItem('selection.wrapInAutoLayout', '⇧A'),
            { separator: true as const },
            { label: 'Align left', shortcut: '⌥A' },
            { label: 'Align center', shortcut: '⌥H' },
            { label: 'Align right', shortcut: '⌥D' },
            { separator: true as const },
            { label: 'Align top', shortcut: '⌥W' },
            { label: 'Align middle', shortcut: '⌥V' },
            { label: 'Align bottom', shortcut: '⌥S' }
          ]
        }
      }

      return menu
    }),
    { label: 'Text', items: textMenu }
  ])

  return {
    topMenus
  }
}
