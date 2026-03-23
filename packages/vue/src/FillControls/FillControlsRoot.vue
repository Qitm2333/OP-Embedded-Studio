<script setup lang="ts">
import { DEFAULT_SHAPE_FILL } from '@open-pencil/core'

import { useFillVariableBinding } from '../shared/use-fill-variable-binding'

const ctx = useFillVariableBinding()
</script>

<template>
  <slot
    :store="ctx.store"
    :default-fill="DEFAULT_SHAPE_FILL"
    :color-variables="ctx.colorVariables.value"
    :search-term="ctx.searchTerm.value"
    :filtered-variables="ctx.filteredVariables.value"
    :get-bound-variable="ctx.getBoundVariable"
    :bind-fill-variable="ctx.bindFillVariable"
    :unbind-fill-variable="ctx.unbindFillVariable"
  />
</template>
