<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuPortal
} from 'reka-ui'
import {
  vTestId,
  useEditorCommands,
  useI18n,
  useMenuModel,
  useSelectionState,
  editorCommandMetadata,
  formatShortcut
} from '@open-pencil/vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import { useCanvasContextMenu } from '@/app/editor/canvas/menu/context'
import { canvasMenuItemClass, canvasMenuShortcutClass } from '@/app/editor/canvas/menu/model'
import { menu, useMenuUI } from '@/components/ui/menu'

const store = useEditorStore()

const { editor, selectedIds, hasSelection } = useSelectionState()
const { getCommand } = useEditorCommands()
const { canvasMenu } = useMenuModel()
const { menu: t } = useI18n()

const canvasMenuActions = createCanvasMenuActions(store, selectedIds)
const { execCommand } = canvasMenuActions
const contextMenu = useCanvasContextMenu(canvasMenu, hasSelection, editor, canvasMenuActions, t)

const menuCls = useMenuUI({
  content: 'min-w-56 shadow-[0_8px_30px_rgb(0_0_0/0.4)] animate-in fade-in zoom-in-95',
  separator: 'my-1'
})
const componentMenu = menu({ tone: 'component' })

const cls = {
  menu: menuCls.content,
  item: menuCls.item,
  component: componentMenu.item(),
  sep: menuCls.separator
}

function contextCommandTestId(id: EditorCommandId | undefined): string | undefined {
  return id ? editorCommandMetadata(id).contextTestId : undefined
}
</script>

<template>
  <ContextMenuContent :class="cls.menu" :side-offset="2" align="start">
    <ContextMenuItem
      data-test-id="context-copy"
      :class="cls.item"
      :disabled="!hasSelection"
      @select="execCommand('copy')"
    >
      <span>{{ t.copy }}</span
      ><span class="text-[11px] text-muted">{{ appMenuShortcutLabel('copy') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-cut"
      :class="cls.item"
      :disabled="!hasSelection"
      @select="execCommand('cut')"
    >
      <span>{{ t.cut }}</span
      ><span class="text-[11px] text-muted">{{ appMenuShortcutLabel('cut') }}</span>
    </ContextMenuItem>
    <ContextMenuItem data-test-id="context-paste" :class="cls.item" @select="execCommand('paste')">
      <span>{{ t.pasteHere }}</span
      ><span class="text-[11px] text-muted">{{ appMenuShortcutLabel('paste') }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-paste-to-replace"
      :class="cls.item"
      :disabled="!hasSelection"
      @select="canvasMenuActions.pasteToReplace"
    >
      <span>{{ t.pasteToReplace }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-duplicate"
      :class="cls.item"
      :disabled="!hasSelection"
      @select="getCommand('selection.duplicate').run()"
    >
      <span>{{ getCommand('selection.duplicate').label }}</span
      ><span class="text-[11px] text-muted">{{
        formatShortcut(editorCommandMetadata('selection.duplicate').shortcut)
      }}</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-delete"
      :class="cls.item"
      :disabled="!hasSelection"
      @select="getCommand('selection.delete').run()"
    >
      <span>{{ getCommand('selection.delete').label }}</span
      ><span class="text-[11px] text-muted">{{
        editorCommandMetadata('selection.delete').shortcut
      }}</span>
    </ContextMenuItem>

    <template v-for="(item, i) in contextMenu" :key="`menu-${i}`">
      <ContextMenuSeparator v-if="item.separator" :class="cls.sep" />
      <ContextMenuSub v-else-if="item.sub">
        <ContextMenuSubTrigger v-test-id="item.testId" :class="cls.item">
          <span>{{ item.label }}</span
          ><span class="text-sm text-muted">›</span>
        </ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent :class="cls.menu">
            <ContextMenuItem
              v-for="(sub, j) in item.sub"
              :key="j"
              :class="cls.item"
              v-test-id="sub.separator ? undefined : sub.testId"
              :disabled="sub.separator ? true : sub.disabled"
              @select="!sub.separator && sub.action?.()"
            >
              <template v-if="!sub.separator">
                <span class="flex-1">{{ sub.label }}</span>
                <span v-if="sub.shortcut" class="text-[11px] text-muted">{{ sub.shortcut }}</span>
              </template>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
      <ContextMenuItem
        v-else
        v-test-id="contextCommandTestId(item.id)"
        :class="canvasMenuItemClass(item.label, cls)"
        :disabled="item.disabled"
        @select="item.action?.()"
      >
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="text-[11px]"
          :class="canvasMenuShortcutClass(item.label)"
          >{{ item.shortcut }}</span
        >
      </ContextMenuItem>
    </template>

  </ContextMenuContent>
</template>
