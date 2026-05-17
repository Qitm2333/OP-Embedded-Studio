import type { AppMenuActionItem, AppMenuEntry } from '@/app/shell/menu/schema'
import { APP_MENU_SCHEMA } from '@/app/shell/menu/schema'

function isActionItem(entry: AppMenuEntry): entry is AppMenuActionItem {
  return !('type' in entry && entry.type === 'separator')
}

function findShortcutInEntries(entries: readonly AppMenuEntry[], id: string): string | undefined {
  for (const entry of entries) {
    if (!isActionItem(entry)) continue
    if (entry.id === id) return entry.shortcut
    const shortcut = entry.sub ? findShortcutInEntries(entry.sub, id) : undefined
    if (shortcut) return shortcut
  }
  return undefined
}

export function appMenuShortcut(id: string): string | undefined {
  for (const group of APP_MENU_SCHEMA) {
    const shortcut = findShortcutInEntries(group.items, id)
    if (shortcut) return shortcut
  }
  return undefined
}

export function appMenuTinykeysShortcut(id: string): string | string[] | undefined {
  const shortcut = appMenuShortcut(id)
  return shortcut
    ?.replaceAll('MOD', '$mod')
    .replaceAll('SHIFT', 'Shift')
    .replaceAll('ALT', 'Alt')
}
