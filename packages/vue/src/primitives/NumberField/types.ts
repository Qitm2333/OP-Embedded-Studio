import type { ComputedRef, Ref, VNode } from 'vue'

import type { NumberExpressionError } from '#vue/controls/number-expression'

export type NumberFieldEditPolicy = 'editable' | 'readonly' | 'detach-on-edit'
export type NumberFieldMutationSource = 'edit' | 'scrub' | 'step'

export interface NumberFieldRootProps {
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  sensitivity?: number
  placeholder?: string
  ariaLabel?: string
  disabled?: boolean
  bound?: boolean
  editPolicy?: NumberFieldEditPolicy
}

export interface NumberFieldRootEmits {
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
  'editing-change': [editing: boolean]
  invalid: [expression: string, reason: NumberExpressionError]
  'detach-request': [source: NumberFieldMutationSource]
}

export interface NumberFieldState {
  editing: boolean
  scrubbing: boolean
  mixed: boolean
  disabled: boolean
  bound: boolean
}

export interface NumberFieldStateAttrs {
  'data-editing'?: ''
  'data-scrubbing'?: ''
  'data-mixed'?: ''
  'data-disabled'?: ''
  'data-bound'?: ''
}

export interface NumberFieldRootAttrs extends NumberFieldStateAttrs {
  role: 'spinbutton' | undefined
  tabindex: 0 | -1 | undefined
  'aria-valuenow'?: number
  'aria-valuemin'?: number
  'aria-valuemax'?: number
  'aria-disabled'?: 'true'
  'aria-label'?: string
  onFocus: () => void
  onKeydown: (event: KeyboardEvent) => void
}

export interface NumberFieldActions {
  startScrub(event: PointerEvent): void
  startEdit(): void
  cancelEdit(): void
  commitEdit(event?: Event): void
  setDraft(value: string): void
  input(event: Event): void
  keydown(event: KeyboardEvent): void
}

export interface NumberFieldSlotProps extends NumberFieldState {
  modelValue: number | symbol
  displayValue: string
  draftValue: string
  isMixed: boolean
  placeholder: string
  state: NumberFieldState
  attrs: NumberFieldRootAttrs
  actions: NumberFieldActions
}

export interface NumberFieldRootSlots {
  default(props: NumberFieldSlotProps): VNode[]
}

export interface NumberFieldValueSlots {
  default(props: NumberFieldSlotProps & { value: string }): VNode[]
}

export interface NumberFieldContext {
  modelValue: ComputedRef<number | symbol>
  numericValue: ComputedRef<number>
  displayValue: ComputedRef<string>
  draftValue: Ref<string>
  isMixed: ComputedRef<boolean>
  editing: Ref<boolean>
  scrubbing: Ref<boolean>
  disabled: ComputedRef<boolean>
  bound: ComputedRef<boolean>
  min: ComputedRef<number>
  max: ComputedRef<number>
  step: ComputedRef<number>
  inputRef: Ref<HTMLInputElement | null>
  state: ComputedRef<NumberFieldState>
  stateAttrs: ComputedRef<NumberFieldStateAttrs>
  rootAttrs: ComputedRef<NumberFieldRootAttrs>
  slotProps: ComputedRef<NumberFieldSlotProps>
  actions: NumberFieldActions
  invalidReason: Ref<NumberExpressionError | null>
}
