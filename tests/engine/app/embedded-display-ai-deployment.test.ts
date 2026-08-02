import { describe, expect, test } from 'bun:test'

import { isDirectUsbFrameDeploymentRequest } from '@/app/ai/device/tools'
import type { EmbeddedDisplayProfile } from '@/features/embedded-display'
import {
  prepareUsbFrameDeployment,
  prepareUsbPrototypeDeployment
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
  test('handles explicit deployment commands locally but leaves questions to the model', () => {
    expect(isDirectUsbFrameDeploymentRequest('写入')).toBe(true)
    expect(isDirectUsbFrameDeploymentRequest('帮我部署到设备')).toBe(true)
    expect(isDirectUsbFrameDeploymentRequest('flash this to the device')).toBe(true)
    expect(isDirectUsbFrameDeploymentRequest('如何写入 USB？')).toBe(false)
    expect(isDirectUsbFrameDeploymentRequest('你在吗')).toBe(false)
    expect(isDirectUsbFrameDeploymentRequest('创建交互并烧录')).toBe(false)
    expect(isDirectUsbFrameDeploymentRequest('deploy this multi-frame prototype')).toBe(false)
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
          width: 1,
          height: 1
        },
        file: new File([new Uint8Array([0])], 'device.png', { type: 'image/png' }),
        backgroundColor: '#000000',
        firstDeployment: true
      })

      expect(plan.status).toBe('ready')
      expect(plan.needsDeviceSelection).toBe(true)
      expect(serialCalls).toBe(0)
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
          width: 1,
          height: 1
        },
        bake: {
          id: 'interaction-1',
          name: 'Navigation',
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
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor)
        else Reflect.deleteProperty(globalThis, key)
      }
    }
  })
})
