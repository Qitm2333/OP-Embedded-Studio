import { describe, expect, test } from 'bun:test'

import { computed, nextTick, ref } from 'vue'

import {
  type DeploymentCardStatus,
  useDeploymentCardDisclosure
} from '@/components/chat/useDeploymentCardDisclosure'

describe('device deployment card disclosure', () => {
  test('collapses terminal cards while keeping active and error cards open', async () => {
    const status = ref<DeploymentCardStatus>('ready')
    const { open } = useDeploymentCardDisclosure(computed(() => status.value))

    expect(open.value).toBe(true)
    status.value = 'terminal'
    await nextTick()
    expect(open.value).toBe(false)

    open.value = true
    expect(open.value).toBe(true)

    status.value = 'error'
    await nextTick()
    expect(open.value).toBe(true)

    status.value = 'terminal'
    await nextTick()
    expect(open.value).toBe(false)
  })
})
