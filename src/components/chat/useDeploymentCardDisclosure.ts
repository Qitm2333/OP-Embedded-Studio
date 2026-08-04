import { computed, ref, watch, type ComputedRef, type WritableComputedRef } from 'vue'

export type DeploymentCardStatus = 'ready' | 'active' | 'error' | 'terminal'

export function useDeploymentCardDisclosure(status: ComputedRef<DeploymentCardStatus>): {
  open: WritableComputedRef<boolean>
} {
  const expanded = ref(status.value !== 'terminal')

  watch(status, (next, previous) => {
    if (next === 'terminal') expanded.value = false
    else if (previous === 'terminal' || next === 'error' || next === 'ready') {
      expanded.value = true
    }
  })

  return {
    open: computed({
      get: () => expanded.value,
      set: (value) => {
        expanded.value = value
      }
    })
  }
}
