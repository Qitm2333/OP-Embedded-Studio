import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ref } from 'vue'

import { MIXED } from '#vue/controls/node-props/use'

import NumberFieldInput from './NumberFieldInput.vue'
import NumberFieldRoot from './NumberFieldRoot.vue'
import NumberFieldValue from './NumberFieldValue.vue'
import { NumberFieldLeading, NumberFieldMenu, NumberFieldTrailing, NumberFieldUnit } from './parts'

const meta = {
  title: 'Vue SDK/Primitives/NumberField',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Headless numeric field with pointer scrubbing, keyboard stepping, arithmetic expressions, mixed values, and binding-aware state.'
      }
    }
  }
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function renderStateMatrix() {
  return {
    components: {
      NumberFieldInput,
      NumberFieldLeading,
      NumberFieldMenu,
      NumberFieldRoot,
      NumberFieldTrailing,
      NumberFieldUnit,
      NumberFieldValue
    },
    setup() {
      const value = ref<number | symbol>(24)
      const mixed = ref<number | symbol>(MIXED)
      const disabled = ref<number | symbol>(16)
      const bound = ref<number | symbol>(8)
      return { value, mixed, disabled, bound }
    },
    template: `
      <div class="w-[520px] space-y-5 rounded-lg border border-border bg-panel p-5">
        <div>
          <h2 class="mb-1 text-xs font-semibold">Interactive anatomy</h2>
          <p class="mb-2 text-[11px] text-muted">Try +10, *2, 50%, or 12*8+4</p>
          <NumberFieldRoot v-slot="{ attrs, editing, actions }" v-model="value" :min="0" :max="200" :step="2" aria-label="Interactive number field">
            <div
              v-bind="attrs"
              data-story-control
              class="flex h-control w-56 items-center rounded-panel border border-transparent bg-panel-field text-xs outline-none focus-within:border-panel-focus"
              @pointerdown="!editing && actions.startScrub($event)"
            >
              <NumberFieldLeading class="px-2 text-muted">W</NumberFieldLeading>
              <NumberFieldInput data-test-id="interactive-number-input" class="min-w-0 flex-1 border-0 bg-transparent outline-none" />
              <NumberFieldValue class="min-w-0 flex-1 truncate" />
              <NumberFieldUnit class="pr-1 text-muted">px</NumberFieldUnit>
              <NumberFieldTrailing class="flex size-control items-center justify-center text-muted">
                R
              </NumberFieldTrailing>
              <NumberFieldMenu class="flex size-control items-center justify-center text-muted">
                M
              </NumberFieldMenu>
            </div>
          </NumberFieldRoot>
        </div>

        <div class="grid grid-cols-3 gap-panel">
          <div>
            <p class="mb-1 text-[11px] text-muted">Mixed</p>
            <NumberFieldRoot v-slot="{ attrs, editing, actions }" v-model="mixed" aria-label="Mixed number field">
              <div
                v-bind="attrs"
                class="flex h-control items-center rounded-panel bg-panel-field px-2 text-xs"
                @pointerdown="!editing && actions.startScrub($event)"
              >
                <NumberFieldInput class="min-w-0 flex-1 bg-transparent outline-none" />
                <NumberFieldValue class="text-muted" />
              </div>
            </NumberFieldRoot>
          </div>

          <div>
            <p class="mb-1 text-[11px] text-muted">Disabled</p>
            <NumberFieldRoot v-slot="{ attrs }" v-model="disabled" aria-label="Disabled number field" disabled>
              <div
                v-bind="attrs"
                class="flex h-control items-center rounded-panel bg-panel-field px-2 text-xs opacity-60"
              >
                <NumberFieldValue />
              </div>
            </NumberFieldRoot>
          </div>

          <div>
            <p class="mb-1 text-[11px] text-muted">Bound</p>
            <NumberFieldRoot v-slot="{ attrs, editing, actions }" v-model="bound" aria-label="Bound number field" bound>
              <div
                v-bind="attrs"
                class="flex h-control items-center rounded-panel bg-panel-field px-2 text-xs text-component"
                @pointerdown="!editing && actions.startScrub($event)"
              >
                <NumberFieldInput class="min-w-0 flex-1 bg-transparent outline-none" />
                <NumberFieldValue />
                <NumberFieldUnit class="ml-1">gap/md</NumberFieldUnit>
              </div>
            </NumberFieldRoot>
          </div>
        </div>
      </div>
    `
  }
}

export const StateMatrix: Story = {
  render: renderStateMatrix,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const root = canvas.getByLabelText('Interactive number field')

    await expect(root).toHaveStyle({ height: '26px' })
    await userEvent.click(root)
    const input = canvasElement.querySelector<HTMLInputElement>(
      '[data-test-id="interactive-number-input"]'
    )
    if (!input) throw new Error('Expected the editing NumberField input')
    await userEvent.clear(input)
    await userEvent.type(input, '12*8+4{Enter}')
    await expect(root).toHaveAttribute('aria-valuenow', '100')

    await expect(canvas.getByLabelText('Mixed number field')).toHaveAttribute('data-mixed')
    await expect(canvas.getByLabelText('Disabled number field')).toHaveAttribute('data-disabled')
    await expect(canvas.getByLabelText('Bound number field')).toHaveAttribute('data-bound')
  }
}

export const Editing: Story = {
  render: renderStateMatrix,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByLabelText('Interactive number field'))
    await expect(
      canvasElement.querySelector('[data-test-id="interactive-number-input"]')
    ).toBeVisible()
  }
}
