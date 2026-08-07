import type { EditorStore } from '@/app/editor/active-store'
import { bakeEmbeddedFrameById, isEmbeddedVisualSource } from '@/app/editor/embedded-display-bake'
import {
  cancelUsbFrameDeployment,
  executeUsbFrameDeployment,
  getActiveEmbeddedDisplayProfile,
  getActiveEmbeddedImageSettings,
  getUsbFrameDeploymentPlan,
  hasRememberedUsbFirmware,
  prepareUsbFrameDeployment,
  setActiveEmbeddedImageSettings,
  updateUsbFrameDeploymentAdaptation,
  type EmbeddedImagePlacement,
  type UsbFrameDeploymentPlan
} from '@/features/embedded-display'

import { rememberUsbDeployment, rememberUsbFirmware, resolveDesignHandoffFrame } from './memory'

const planStores = new Map<string, EditorStore>()

function prunePlanStores(): void {
  for (const planId of planStores.keys()) {
    const status = getUsbFrameDeploymentPlan(planId)?.status
    if (!status || ['success', 'cancelled', 'superseded', 'stale'].includes(status)) {
      planStores.delete(planId)
    }
  }
}

export async function prepareUsbFrameDeploymentFromStore(
  store: EditorStore,
  backgroundColor?: string,
  placement?: EmbeddedImagePlacement
): Promise<UsbFrameDeploymentPlan> {
  const frame = resolveDesignHandoffFrame(store)
  if (!frame.available) {
    throw new Error(frame.reason || '请先选择一个 Frame、图片或 Frame 内的元素')
  }
  const file = await bakeEmbeddedFrameById(store, frame.id)
  if (!file) throw new Error('无法渲染当前画面，请重新选择后再试')
  const profile = getActiveEmbeddedDisplayProfile()
  const settings = getActiveEmbeddedImageSettings()
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
    backgroundColor: backgroundColor ?? settings.backgroundColor,
    placement: placement ?? settings.placement,
    firstDeployment: !hasRememberedUsbFirmware(profile.id),
    scopeKey: store
  })
  setActiveEmbeddedImageSettings({
    placement: plan.placement,
    backgroundColor: plan.backgroundColor
  })
  prunePlanStores()
  planStores.set(plan.id, store)
  return plan
}

export function cancelUsbFrameDeploymentFromChat(planId: string): void {
  cancelUsbFrameDeployment(planId)
  prunePlanStores()
}

export async function updateUsbFrameDeploymentAdaptationFromChat(
  planId: string,
  placement: EmbeddedImagePlacement,
  backgroundColor?: string
): Promise<boolean> {
  const updated = await updateUsbFrameDeploymentAdaptation(planId, {
    placement,
    backgroundColor
  })
  if (!updated) return false
  const plan = getUsbFrameDeploymentPlan(planId)
  if (plan) {
    setActiveEmbeddedImageSettings({
      placement: plan.placement,
      backgroundColor: plan.backgroundColor
    })
  }
  return true
}

export async function executeUsbFrameDeploymentFromChat(planId: string): Promise<boolean> {
  const store = planStores.get(planId)
  const plan = getUsbFrameDeploymentPlan(planId)
  if (!store || !plan) return false
  const result = await executeUsbFrameDeployment(planId, {
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
  prunePlanStores()
  return result
}
