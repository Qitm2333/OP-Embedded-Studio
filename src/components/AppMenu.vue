<script setup lang="ts">
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarItemIndicator,
  MenubarMenu,
  MenubarPortal,
  MenubarRoot,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger
} from 'reka-ui'

import IconChevronRight from '~icons/lucide/chevron-right'

import { computed } from 'vue'

import { useEditorCommands, useInlineRename, useMenuModel } from '@open-pencil/vue'
import { menuContent, menuItem, menuSeparator } from '@/components/ui/menu'
import { IS_TAURI } from '@/constants'
import { openFileDialog } from '@/composables/use-menu'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()
const { menuItem: commandMenuItem } = useEditorCommands()
const { appMenu } = useMenuModel()

const DOCUMENT_NAME_ID = 'document-name'
const rename = useInlineRename<'document-name'>((_id, name) => {
  store.state.documentName = name
})
const editingName = computed(() => rename.editingId.value === DOCUMENT_NAME_ID)

function setNameInputRef(el: HTMLInputElement | null) {
  if (el) void rename.focusInput(el)
}

function startRename() {
  rename.start(DOCUMENT_NAME_ID, store.state.documentName)
}

function commitRename(input: HTMLInputElement) {
  rename.commit(DOCUMENT_NAME_ID, input)
}

const isMac = navigator.platform.includes('Mac')
const mod = isMac ? '⌘' : 'Ctrl+'

interface MenuAction {
  separator?: false
  label: string
  shortcut?: string
  action?: () => void
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  sub?: MenuEntry[]
}

interface MenuSeparator {
  separator: true
}

type MenuEntry = MenuAction | MenuSeparator

const fileMenu: MenuEntry[] = [
  {
    label: 'New',
    shortcut: `${mod}N`,
    action: () => import('@/stores/tabs').then((m) => m.createTab())
  },
  { label: 'Open…', shortcut: `${mod}O`, action: () => openFileDialog() },
  { separator: true },
  { label: 'Save', shortcut: `${mod}S`, action: () => store.saveFigFile() },
  { label: 'Save as…', shortcut: `${mod}⇧S`, action: () => store.saveFigFileAs() },
  { separator: true },
  {
    label: 'Export selection…',
    shortcut: `${mod}⇧E`,
    action: () => {
      if (store.state.selectedIds.size > 0) store.exportSelection(1, 'PNG')
    },
    disabled: store.state.selectedIds.size === 0
  },
  { separator: true },
  {
    label: 'Auto-save to local file',
    get checked() {
      return store.state.autosaveEnabled
    },
    onCheckedChange: (v: boolean) => {
      store.state.autosaveEnabled = v
    }
  }
]

const textMenu: MenuEntry[] = [
  { label: 'Bold', shortcut: `${mod}B` },
  { label: 'Italic', shortcut: `${mod}I` },
  { label: 'Underline', shortcut: `${mod}U` }
]

const topMenus = [
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
          { separator: true },
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
          { separator: true },
          { label: 'Copy', shortcut: `${mod}C` },
          { label: 'Paste', shortcut: `${mod}V` },
          commandMenuItem('selection.duplicate', `${mod}D`),
          commandMenuItem('selection.delete', '⌫'),
          { separator: true },
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
          { separator: true },
          commandMenuItem('selection.createComponent', `${mod}⌥K`),
          commandMenuItem('selection.createComponentSet'),
          commandMenuItem('selection.detachInstance'),
          { separator: true },
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
          { separator: true },
          { label: 'Align left', shortcut: '⌥A' },
          { label: 'Align center', shortcut: '⌥H' },
          { label: 'Align right', shortcut: '⌥D' },
          { separator: true },
          { label: 'Align top', shortcut: '⌥W' },
          { label: 'Align middle', shortcut: '⌥V' },
          { label: 'Align bottom', shortcut: '⌥S' }
        ]
      }
    }

    return menu
  }),
  { label: 'Text', items: textMenu }
]
</script>

<template>
  <div class="shrink-0 border-b border-border">
    <div class="flex items-center gap-2 px-2 py-1.5">
      <img data-test-id="app-logo" src="/favicon-32.png" class="size-4" alt="OpenPencil" />
      <input
        v-if="editingName"
        :ref="(el) => setNameInputRef(el as HTMLInputElement | null)"
        data-test-id="app-document-name-input"
        class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0.5 text-xs text-surface outline-none"
        :value="store.state.documentName"
        @blur="commitRename($event.target as HTMLInputElement)"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown="rename.onKeydown"
      />
      <span
        v-else
        data-test-id="app-document-name"
        class="min-w-0 flex-1 cursor-default truncate rounded px-1 py-0.5 text-xs text-surface hover:bg-hover"
        @dblclick="startRename"
        >{{ store.state.documentName }}</span
      >
      <Tip label="Toggle UI (⌘\)">
        <button
          data-test-id="app-toggle-ui"
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="store.state.showUI = !store.state.showUI"
        >
          <icon-lucide-sidebar class="size-3.5" />
        </button>
      </Tip>
    </div>
    <div v-if="!IS_TAURI" class="flex items-center px-1 pb-1">
      <MenubarRoot class="scrollbar-none flex items-center gap-0.5 overflow-x-auto">
        <MenubarMenu v-for="menu in topMenus" :key="menu.label">
          <MenubarTrigger
            :data-test-id="`menubar-${menu.label.toLowerCase()}`"
            class="flex cursor-pointer items-center rounded px-2 py-1 text-xs text-muted transition-colors select-none hover:bg-hover hover:text-surface data-[state=open]:bg-hover data-[state=open]:text-surface"
          >
            {{ menu.label }}
          </MenubarTrigger>

          <MenubarPortal>
            <MenubarContent
              :side-offset="4"
              align="start"
              :class="menuContent({ class: 'min-w-52' })"
            >
              <template v-for="(item, i) in menu.items" :key="i">
                <MenubarSeparator v-if="'separator' in item && item.separator" :class="menuSeparator()" />
                <MenubarSub v-else-if="'sub' in item && item.sub">
                  <MenubarSubTrigger :class="menuItem()">
                    <span class="flex-1">{{ 'label' in item ? item.label : '' }}</span>
                    <IconChevronRight class="size-3 text-muted" />
                  </MenubarSubTrigger>
                  <MenubarPortal>
                    <MenubarSubContent :side-offset="4" :class="menuContent({ class: 'min-w-44' })">
                      <template v-for="(sub, j) in ('sub' in item && item.sub ? item.sub : [])" :key="j">
                        <MenubarSeparator v-if="'separator' in sub && sub.separator" :class="menuSeparator()" />
                        <MenubarItem
                          v-else
                          :class="menuItem()"
                          :disabled="'disabled' in sub ? sub.disabled : undefined"
                          @select="'action' in sub ? sub.action?.() : undefined"
                        >
                          <span class="flex-1">{{ 'label' in sub ? sub.label : '' }}</span>
                          <span v-if="'shortcut' in sub && sub.shortcut" class="text-[11px] text-muted">{{
                            sub.shortcut
                          }}</span>
                        </MenubarItem>
                      </template>
                    </MenubarSubContent>
                  </MenubarPortal>
                </MenubarSub>
                <MenubarCheckboxItem
                  v-else-if="'onCheckedChange' in item && item.onCheckedChange"
                  :model-value="'checked' in item ? item.checked : undefined"
                  :class="menuItem()"
                  @update:model-value="item.onCheckedChange?.($event as boolean)"
                >
                  <span class="flex-1">{{ 'label' in item ? item.label : '' }}</span>
                  <MenubarItemIndicator class="text-surface">
                    <icon-lucide-check class="size-3.5" />
                  </MenubarItemIndicator>
                </MenubarCheckboxItem>
                <MenubarItem
                  v-else
                  :class="menuItem()"
                  :disabled="'disabled' in item ? item.disabled : undefined"
                  @select="'action' in item ? item.action?.() : undefined"
                >
                  <span class="flex-1">{{ 'label' in item ? item.label : '' }}</span>
                  <span v-if="'shortcut' in item && item.shortcut" class="text-[11px] text-muted">{{
                    item.shortcut
                  }}</span>
                </MenubarItem>
              </template>
            </MenubarContent>
          </MenubarPortal>
        </MenubarMenu>
      </MenubarRoot>
    </div>
  </div>
</template>
