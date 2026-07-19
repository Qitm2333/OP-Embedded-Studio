import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import type { LayerTreeDisplayOrder } from '@open-pencil/vue'

export const layerTreeDisplayOrder = useLocalStorage<LayerTreeDisplayOrder>(
  'op-layer-tree-display-order',
  'document'
)

export const showTopLayersFirst = computed({
  get: () => layerTreeDisplayOrder.value === 'front-first',
  set: (enabled: boolean) => {
    layerTreeDisplayOrder.value = enabled ? 'front-first' : 'document'
  }
})
