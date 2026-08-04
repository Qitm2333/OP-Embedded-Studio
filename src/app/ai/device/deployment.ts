import type { EditorStore } from '@/app/editor/active-store'
import { bakeEmbeddedFrameById, isEmbeddedVisualSource } from '@/app/editor/embedded-display-bake'
import {
  cancelUsbFrameDeployment,
  executeUsbFrameDeployment,
  getActiveEmbeddedDisplayProfile,
  getUsbFrameDeploymentPlan,
  prepareUsbFrameDeployment,
  type UsbFrameDeploymentPlan
} from '@/features/embedded-display'

import {
  hasUsbFirmwareMemory,
  rememberUsbDeployment,
  rememberUsbFirmware,
  resolveDesignHandoffFrame
} from './memory'

const planStores = new Map<string, EditorStore>()

export async function prepareUsbFrameDeploymentFromStore(
  store: EditorStore,
  backgroundColor: string
): Promise<UsbFrameDeploymentPlan> {
  const frame = resolveDesignHandoffFrame(store)
  if (!frame.available) {
    throw new Error(frame.reason || '请先选择一个 Frame、图片或 Frame 内的元素')
  }
  const file = await bakeEmbeddedFrameById(store, frame.id)
  if (!file) throw new Error('无法渲染当前画面，请重新选择后再试')
  const profile = getActiveEmbeddedDisplayProfile()
  const plan = await prepareUsbFrameDeployment({
    profile,
    frame: {
      id: frame.id,
      name: frame.name,
      revision: frame.revision,
      width: frame.width,
      height: frame.height
    },
    file,
    backgroundColor,
    firstDeployment: !(await hasUsbFirmwareMemory(profile.id))
  })
  planStores.set(plan.id, store)
  return plan
}

export function cancelUsbFrameDeploymentFromChat(planId: string): void {
  cancelUsbFrameDeployment(planId)
}

export async function executeUsbFrameDeploymentFromChat(planId: string): Promise<boolean> {
  const store = planStores.get(planId)
  const plan = getUsbFrameDeploymentPlan(planId)
  if (!store || !plan) return false
  return executeUsbFrameDeployment(planId, {
    isSnapshotCurrent: () => {
      return (
        isEmbeddedVisualSource(store.graph.getNode(plan.frame.id)) &&
        store.state.sceneVersion === plan.frame.revision &&
        getActiveEmbeddedDisplayProfile().id === plan.profileId
      )
    },
    onFirmwareVerified: rememberUsbFirmware,
    onSuccess: rememberUsbDeployment
  })
}
