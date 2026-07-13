import type { Loader } from 'vitepress'

import {
  readComponentMeta,
  type SdkComponentMeta
} from '../../../../.vitepress/sdk/component-meta'

const sources = [
  'packages/vue/src/primitives/BindableValue/BindableValueRoot.vue',
  'packages/vue/src/primitives/BindableValue/BindableValueTrigger.vue',
  'packages/vue/src/primitives/BindableValue/BindableValuePicker.vue'
]

export interface BindableValueComponentData {
  components: SdkComponentMeta[]
}

export default {
  watch: sources.map((source) => `../../../../../../${source}`),
  load(): BindableValueComponentData {
    return { components: sources.map(readComponentMeta) }
  }
} satisfies Loader
