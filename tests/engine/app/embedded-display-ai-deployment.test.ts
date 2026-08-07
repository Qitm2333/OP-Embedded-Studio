import { describe, expect, test } from 'bun:test'

import { describeDeviceDeploymentProblem } from '@/app/ai/device/errors'
import {
  resolveEmbeddedImagePlacement,
  updateUsbDeploymentAdaptationOutput
} from '@/app/ai/device/tools'
import type { EmbeddedDisplayProfile } from '@/features/embedded-display'
import {
  cancelUsbFrameDeployment,
  getActiveEmbeddedImageSettings,
  normalizeUsbDeploymentError,
  prepareUsbFrameDeployment,
  prepareUsbPrototypeDeployment,
  updateUsbFrameDeploymentAdaptation
} from '@/features/embedded-display'

const profile: EmbeddedDisplayProfile = {
  id: 'co5300_waveshare_amoled_1_75c',
  name: 'Test display',
  controller: 'CO5300',
  resolution: { width: 1, height: 1 },
  interface: 'QSPI',
  backgroundColor: '#000000',
  description: 'Test profile',
  verified: true
}

describe('AI USB deployment planning', () => {
  test('resolves explicit placement requests for local deployment actions', () => {
    expect(resolveEmbeddedImagePlacement('拉伸后烧录到设备')).toBe('stretch')
    expect(resolveEmbeddedImagePlacement('等比缩放并部署')).toBe('contain')
    expect(resolveEmbeddedImagePlacement('保持 1:1 不缩放')).toBe('pixel-perfect')
    expect(resolveEmbeddedImagePlacement('deploy at original size')).toBe('pixel-perfect')
    expect(resolveEmbeddedImagePlacement('保持比例烧录')).toBe('contain')
    expect(resolveEmbeddedImagePlacement('keep the aspect ratio and deploy')).toBe('contain')
    expect(resolveEmbeddedImagePlacement('deploy the profit chart')).toBeUndefined()
    expect(resolveEmbeddedImagePlacement('deploy the fulfilled state')).toBeUndefined()
    expect(resolveEmbeddedImagePlacement('直接烧录')).toBeUndefined()
  })

  test('renders a confirmation plan without accessing Web Serial', async () => {
    const descriptors = {
      createImageBitmap: Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap'),
      document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
      navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    }
    let serialCalls = 0
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: async () => ({ width: 1, height: 1, close: () => undefined })
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => ({
            fillStyle: '',
            imageSmoothingEnabled: true,
            fillRect: () => undefined,
            drawImage: () => undefined,
            getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })
          })
        })
      }
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serial: {
          getPorts: async () => {
            serialCalls += 1
            return []
          }
        }
      }
    })

    try {
      const plan = await prepareUsbFrameDeployment({
        profile,
        frame: {
          id: 'frame-1',
          name: 'Device UI',
          revision: 7,
          width: 320,
          height: 180
        },
        file: new File([new Uint8Array([0])], 'device.png', { type: 'image/png' }),
        backgroundColor: '#000000',
        firstDeployment: true
      })

      expect(plan.status).toBe('ready')
      expect(plan.needsDeviceSelection).toBe(true)
      expect(serialCalls).toBe(0)
      const adaptation = await updateUsbDeploymentAdaptationOutput(plan.id, 'stretch', '#123456')
      expect(adaptation).toMatchObject({
        kind: 'usb-deployment-adaptation-updated',
        targetId: plan.id,
        adaptation: { placement: 'stretch', backgroundColor: '#123456' }
      })
      expect(plan.placement).toBe('stretch')
      expect(plan.backgroundColor).toBe('#123456')
      expect(getActiveEmbeddedImageSettings()).toEqual({
        placement: 'stretch',
        backgroundColor: '#123456'
      })
      expect(plan.message).toBe('画面适配已更新，等待确认')
      expect(serialCalls).toBe(0)

      const replacement = await prepareUsbFrameDeployment({
        profile,
        frame: {
          id: 'frame-2',
          name: 'Updated UI',
          revision: 8,
          width: 466,
          height: 466
        },
        file: new File([new Uint8Array([0])], 'updated.png', { type: 'image/png' }),
        backgroundColor: '#000000',
        firstDeployment: false
      })
      expect(plan.status).toBe('superseded')
      expect(plan.message).toBe('已由新的烧录计划替代')
      expect(replacement.status).toBe('ready')

      cancelUsbFrameDeployment(replacement.id)
      await prepareUsbFrameDeployment({
        profile,
        frame: {
          id: 'frame-3',
          name: 'Latest UI',
          revision: 9,
          width: 466,
          height: 466
        },
        file: new File([new Uint8Array([0])], 'latest.png', { type: 'image/png' }),
        backgroundColor: '#000000',
        firstDeployment: false
      })
      expect(replacement.status).toBe('cancelled')
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  })

  test('prepares a prototype plan without accessing Web Serial', async () => {
    const descriptors = {
      createImageBitmap: Object.getOwnPropertyDescriptor(globalThis, 'createImageBitmap'),
      document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
      navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    }
    let serialCalls = 0
    Object.defineProperty(globalThis, 'createImageBitmap', {
      configurable: true,
      value: async () => ({ width: 1, height: 1, close: () => undefined })
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => ({
            fillStyle: '',
            imageSmoothingEnabled: true,
            fillRect: () => undefined,
            drawImage: () => undefined,
            getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })
          })
        })
      }
    })
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serial: {
          getPorts: async () => {
            serialCalls += 1
            return []
          }
        }
      }
    })

    try {
      const first = new File([new Uint8Array([0])], 'home.png', { type: 'image/png' })
      const second = new File([new Uint8Array([0])], 'detail.png', { type: 'image/png' })
      const plan = await prepareUsbPrototypeDeployment({
        profile,
        frame: {
          id: 'home',
          name: 'Home',
          revision: 8,
          width: 240,
          height: 240
        },
        bake: {
          id: 'interaction-1',
          name: 'Navigation',
          mode: 'custom',
          intervalMs: 3000,
          initialStateId: 'home',
          states: [
            { id: 'home', name: 'Home', file: first },
            { id: 'detail', name: 'Detail', file: second }
          ],
          transitions: [
            { fromStateId: 'home', event: 'screen_click', toStateId: 'detail' },
            { fromStateId: 'detail', event: 'screen_click', toStateId: 'home' }
          ]
        },
        backgroundColor: '#000000',
        firstDeployment: true
      })

      expect(plan.mode).toBe('prototype')
      expect(plan.prototype?.stateCount).toBe(2)
      expect(plan.status).toBe('ready')
      expect(plan.needsDeviceSelection).toBe(true)
      expect(serialCalls).toBe(0)
      expect(await updateUsbFrameDeploymentAdaptation(plan.id, { placement: 'contain' })).toBe(true)
      expect(plan.placement).toBe('contain')
      expect(plan.message).toBe('画面适配已更新，等待确认')
      expect(serialCalls).toBe(0)
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  })

  test('describes common deployment failures with a concrete recovery action', () => {
    expect(describeDeviceDeploymentProblem('内容超过设备 USB 内容分区容量')).toMatchObject({
      title: '内容超过设备容量',
      retryLabel: '重新准备',
      recovery: 'reprepare'
    })
    expect(
      describeDeviceDeploymentProblem('NotFoundError: No port selected by the user')
    ).toMatchObject({
      title: '尚未选择 USB 设备',
      retryLabel: '重新选择设备',
      recovery: 'retry'
    })
    expect(
      describeDeviceDeploymentProblem(
        'USB 设备拒绝内容：CHUNK（错误码 -22；OPUSB/1 ERR -22 CHUNK）'
      )
    ).toMatchObject({
      title: '设备拒绝传输数据块',
      retryLabel: '重新烧录',
      recovery: 'retry'
    })
    expect(describeDeviceDeploymentProblem('设计内容在确认前发生了变化')).toMatchObject({
      title: '烧录内容已经变化',
      recovery: 'reprepare'
    })
    expect(
      normalizeUsbDeploymentError(new DOMException('No port selected by the user', 'NotFoundError'))
    ).toBe('未选择 USB 设备，系统设备窗口已关闭')
  })
})
