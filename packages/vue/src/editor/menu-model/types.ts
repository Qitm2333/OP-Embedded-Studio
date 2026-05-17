import type { Component } from 'vue'

import type { EditorCommandId } from '#vue/editor/commands/types'
import type { TestId } from '#vue/testing/test-id'

export interface MenuActionNode {
  separator?: false
  id?: EditorCommandId
  label: string
  icon?: Component
  shortcut?: string
  action?: () => void
  disabled?: boolean
  testId?: TestId
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  sub?: MenuEntry[]
}

export interface MenuSeparatorNode {
  separator: true
}

export type MenuEntry = MenuActionNode | MenuSeparatorNode
