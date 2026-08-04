import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import type { ToolSet } from 'ai'
import * as v from 'valibot'

import type { EditorStore } from '@/app/editor/active-store'
import { DEVICE_PROTOTYPE_EVENTS } from '@/features/device-prototype'
import {
  getUsbFrameDeploymentPlan,
  type EmbeddedImagePlacement
} from '@/features/embedded-display'

import {
  prepareUsbFrameDeploymentFromStore,
  updateUsbFrameDeploymentAdaptationFromChat
} from './deployment'
import {
  getDevicePrototypeProposal,
  prepareDevicePrototypeProposal,
  updateDevicePrototypeAdaptationFromChat,
  type PrepareDevicePrototypeProposalInput
} from './prototype'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

const DIRECT_DEPLOYMENT_TERMS = [
  /写入/u,
  /烧录/u,
  /部署/u,
  /发送到设备/u,
  /传到设备/u,
  /写入\s*usb/iu,
  /\b(?:flash|deploy)\b/iu,
  /\b(?:write|send)\s+(?:it\s+)?to\s+(?:the\s+)?(?:usb|device)\b/iu
]

const QUESTION_MARKERS = [
  /[?？]/u,
  /(?:怎么|如何|为什么|是否|能否|可不可以|可以吗)/u,
  /^\s*(?:how|what|why|when|where|can|could|should|is|does)\b/iu
]

const PROTOTYPE_DEPLOYMENT_MARKERS = [
  /交互/u,
  /状态机/u,
  /手动浏览|手动切换|幻灯片|自动播放|轮播|上一张|下一张/u,
  /多个\s*Frame/iu,
  /multi[ -]?frame/iu,
  /prototype|slideshow|carousel|manual (?:browsing|navigation)/iu
]

const EXISTING_DEPLOYMENT_UPDATE_MARKERS = [
  /(?:改成|改为|改用|调整为|换成|切换为|切换到)/u,
  /\b(?:change|switch|update|adjust)\b/iu,
  /\buse\b.+\binstead\b/iu
]

export function isDirectUsbFrameDeploymentRequest(text: string): boolean {
  const command = text.trim()
  if (
    !command ||
    QUESTION_MARKERS.some((pattern) => pattern.test(command)) ||
    PROTOTYPE_DEPLOYMENT_MARKERS.some((pattern) => pattern.test(command)) ||
    EXISTING_DEPLOYMENT_UPDATE_MARKERS.some((pattern) => pattern.test(command))
  ) {
    return false
  }
  return DIRECT_DEPLOYMENT_TERMS.some((pattern) => pattern.test(command))
}

export function resolveEmbeddedImagePlacement(text: string): EmbeddedImagePlacement | undefined {
  if (
    /(?:不缩放|原始尺寸|原图尺寸|实际尺寸|1\s*:\s*1)/u.test(text) ||
    /\b(?:pixel[- ]?perfect|unscaled|no[- ]scaling|original size|actual size|native size)\b/iu.test(
      text
    )
  ) {
    return 'pixel-perfect'
  }
  if (
    /(?:等比(?:缩放)?|完整显示|保持(?:原始)?比例|按比例|适应屏幕)/u.test(text) ||
    /\b(?:contain|fit|fitted)\b|\b(?:keep|preserve)(?: the)? aspect ratio\b/iu.test(text)
  ) {
    return 'contain'
  }
  if (/(?:拉伸|铺满|填满|拉满)/u.test(text) || /\b(?:stretch|fill)\b/iu.test(text)) {
    return 'stretch'
  }
  return undefined
}

export async function prepareUsbFrameDeploymentOutput(
  store: EditorStore,
  intent: string,
  backgroundColor?: string,
  placement?: EmbeddedImagePlacement
) {
  const plan = await prepareUsbFrameDeploymentFromStore(store, backgroundColor, placement)
  return {
    kind: 'usb-frame-deployment-plan' as const,
    planId: plan.id,
    intent,
    target: {
      profileId: plan.profileId,
      profileName: plan.profileName,
      resolution: plan.resolution,
      roundScreen: plan.roundScreen
    },
    frame: plan.frame,
    adaptation: { placement: plan.placement, backgroundColor: plan.backgroundColor },
    contentBytes: plan.contentBytes,
    firstDeployment: plan.firstDeployment,
    needsDeviceSelection: plan.needsDeviceSelection,
    instruction:
      'The deployment is prepared but not executed. Ask the user to review and confirm the host card.'
  }
}

export async function updateUsbDeploymentAdaptationOutput(
  targetId: string,
  placement?: EmbeddedImagePlacement,
  backgroundColor?: string
) {
  const plan = getUsbFrameDeploymentPlan(targetId)
  if (plan) {
    const updated = await updateUsbFrameDeploymentAdaptationFromChat(
      targetId,
      placement ?? plan.placement,
      backgroundColor
    )
    if (!updated) throw new Error('当前烧录计划正在执行或已经结束，无法修改画面适配')
    return {
      kind: 'usb-deployment-adaptation-updated' as const,
      targetKind: plan.mode === 'frame' ? ('frame' as const) : ('prototype' as const),
      targetId,
      adaptation: {
        placement: plan.placement,
        backgroundColor: plan.backgroundColor
      },
      contentBytes: plan.contentBytes,
      instruction: 'The existing confirmation card has been updated. Do not prepare a new plan.'
    }
  }

  const proposal = getDevicePrototypeProposal(targetId)
  if (!proposal) throw new Error('找不到需要修改的烧录计划')
  const updated = await updateDevicePrototypeAdaptationFromChat(
    targetId,
    placement ?? proposal.placement,
    backgroundColor
  )
  if (!updated) throw new Error('当前交互烧录计划正在执行或已经结束，无法修改画面适配')
  return {
    kind: 'usb-deployment-adaptation-updated' as const,
    targetKind: 'prototype' as const,
    targetId,
    adaptation: {
      placement: proposal.placement,
      backgroundColor: proposal.backgroundColor
    },
    instruction: 'The existing confirmation card has been updated. Do not prepare a new plan.'
  }
}

export function prepareUsbPrototypeDeploymentOutput(
  store: EditorStore,
  input: PrepareDevicePrototypeProposalInput
) {
  const proposal = prepareDevicePrototypeProposal(store, input)
  return {
    kind: 'usb-prototype-deployment-proposal' as const,
    proposalId: proposal.id,
    intent: proposal.intent,
    target: {
      profileId: proposal.profileId,
      profileName: proposal.profileName,
      resolution: proposal.resolution,
      roundScreen: proposal.roundScreen
    },
    interaction: {
      name: proposal.name,
      mode: proposal.mode,
      manual: proposal.manual,
      slideshow: proposal.slideshow,
      initialStateId: proposal.definition.initialStateId,
      states: proposal.definition.states.map((state) => ({
        id: state.id,
        name: state.name
      })),
      transitions: proposal.definition.transitions
    },
    adaptation: {
      placement: proposal.placement,
      backgroundColor: proposal.backgroundColor
    },
    instruction:
      'The interaction is proposed but not created. Ask the user to review and confirm the host card.'
  }
}

export function createDeviceTools(store: EditorStore): ToolSet {
  return {
    prepare_usb_frame_deployment: tool({
      description:
        'Prepare a USB single-screen deployment plan for the selected Frame or image and active device. The active display adaptation is used unless placement or backgroundColor is explicitly requested. Hardware execution requires confirmation.',
      inputSchema: valibotSchema(
        v.object({
          intent: v.pipe(
            v.string(),
            v.minLength(1),
            v.description(
              'A concise user-facing description in the language of the latest user message'
            )
          ),
          backgroundColor: v.optional(
            v.pipe(
              v.string(),
              v.regex(HEX_COLOR),
              v.description('Opaque fallback color for transparent pixels, as #RRGGBB')
            )
          ),
          placement: v.optional(v.picklist(['stretch', 'contain', 'pixel-perfect']))
        })
      ),
      execute: async ({ intent, backgroundColor, placement }) => {
        try {
          return await prepareUsbFrameDeploymentOutput(store, intent, backgroundColor, placement)
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            instruction: 'Resolve the blocking condition before preparing another deployment plan.'
          }
        }
      }
    }),
    update_usb_deployment_adaptation: tool({
      description:
        'Update the placement or background color of an existing unexecuted USB deployment confirmation card. Use the planId or proposalId from the prior preparation tool result. This rebuilds content but does not access hardware.',
      inputSchema: valibotSchema(
        v.object({
          targetId: v.pipe(
            v.string(),
            v.minLength(1),
            v.description('The existing planId or proposalId to update')
          ),
          backgroundColor: v.optional(v.pipe(v.string(), v.regex(HEX_COLOR))),
          placement: v.optional(v.picklist(['stretch', 'contain', 'pixel-perfect']))
        })
      ),
      execute: async ({ targetId, backgroundColor, placement }) => {
        try {
          if (!backgroundColor && !placement) {
            throw new Error('请至少指定缩放方式或背景颜色')
          }
          return await updateUsbDeploymentAdaptationOutput(targetId, placement, backgroundColor)
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            instruction: 'Keep the existing card unchanged and explain why it cannot be updated.'
          }
        }
      }
    }),
    prepare_usb_prototype_deployment: tool({
      description:
        'Prepare a manual browsing, slideshow, or custom multi-screen interaction and USB deployment proposal from Frame or image IDs in the active page context. Different source dimensions are supported and converted independently for the target device.',
      inputSchema: valibotSchema(
        v.object({
          intent: v.pipe(
            v.string(),
            v.minLength(1),
            v.description('A concise user-facing description in the latest user language')
          ),
          name: v.pipe(v.string(), v.minLength(1), v.description('Name of the new interaction')),
          mode: v.picklist(['manual', 'slideshow', 'custom']),
          frameIds: v.pipe(
            v.array(v.string()),
            v.minLength(2),
            v.maxLength(10),
            v.description('Ordered Frame or image node IDs to include as interaction states')
          ),
          initialFrameId: v.pipe(v.string(), v.minLength(1)),
          transitions: v.optional(
            v.array(
              v.object({
                fromFrameId: v.string(),
                event: v.picklist(DEVICE_PROTOTYPE_EVENTS.map((event) => event.id)),
                toFrameId: v.string()
              })
            ),
            []
          ),
          manual: v.optional(
            v.object({
              nextEvent: v.optional(
                v.picklist(DEVICE_PROTOTYPE_EVENTS.map((event) => event.id)),
                'screen_click'
              ),
              previousEvent: v.optional(
                v.picklist(DEVICE_PROTOTYPE_EVENTS.map((event) => event.id)),
                'screen_long_press'
              ),
              loop: v.optional(v.boolean(), true)
            })
          ),
          slideshow: v.optional(
            v.object({
              intervalMs: v.optional(v.pipe(v.number(), v.minValue(500), v.maxValue(60000)), 3000)
            })
          ),
          backgroundColor: v.optional(v.pipe(v.string(), v.regex(HEX_COLOR))),
          placement: v.optional(v.picklist(['stretch', 'contain', 'pixel-perfect']))
        })
      ),
      execute: async (input) => {
        try {
          return prepareUsbPrototypeDeploymentOutput(store, input)
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            instruction: 'Resolve the invalid Frame or transition configuration.'
          }
        }
      }
    })
  }
}
