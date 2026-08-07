import { describe, expect, test } from 'bun:test'

import {
  transferUsbContentWithFirmwareFallback,
  type UsbContentFirmwareDependencies,
  type UsbContentFirmwareStage
} from '@/features/embedded-display/adapters/usb-content-firmware'
import {
  UsbContentDeviceUnavailableError,
  UsbContentFirmwareError,
  type UsbContentSerialPort
} from '@/features/embedded-display/adapters/usb-content-transfer'

const port = {} as UsbContentSerialPort
const reconnectedPort = {} as UsbContentSerialPort

function dependencies(onFlash: () => void): UsbContentFirmwareDependencies {
  return {
    flashManifest: async () => onFlash(),
    getAuthorizedPort: async () => reconnectedPort,
    delay: async () => undefined,
    reconnectAttempts: 3,
    reconnectDelayMs: 0
  }
}

describe('USB automatic firmware flow', () => {
  test('uploads compatible content in one attempt without a separate probe', async () => {
    let flashCount = 0
    let transferCount = 0
    const stages: UsbContentFirmwareStage[] = []
    const result = await transferUsbContentWithFirmwareFallback(
      {
        port,
        manifestUrl: '/firmware.json',
        transfer: async (activePort, firmwareUpdated) => {
          transferCount += 1
          expect(activePort).toBe(port)
          expect(firmwareUpdated).toBe(false)
          return 4096
        },
        onStage: (stage) => stages.push(stage)
      },
      dependencies(() => {
        flashCount += 1
      })
    )

    expect(result).toEqual({ port, capacity: 4096, firmwareUpdated: false })
    expect(transferCount).toBe(1)
    expect(flashCount).toBe(0)
    expect(stages).toEqual(['checking', 'transferring', 'ready'])
  })

  test('flashes every recoverable mismatch and uploads immediately after reconnecting', async () => {
    for (const issue of ['missing', 'protocol', 'resolution'] as const) {
      let flashCount = 0
      let transferCount = 0
      const stages: UsbContentFirmwareStage[] = []
      const result = await transferUsbContentWithFirmwareFallback(
        {
          port,
          manifestUrl: '/firmware.json',
          transfer: async (activePort, firmwareUpdated) => {
            transferCount += 1
            if (transferCount === 1) {
              throw new UsbContentFirmwareError(issue, `固件问题：${issue}`)
            }
            expect(activePort).toBe(reconnectedPort)
            expect(firmwareUpdated).toBe(true)
            return 4096
          },
          onStage: (stage) => stages.push(stage)
        },
        dependencies(() => {
          flashCount += 1
        })
      )

      expect(result).toEqual({ port: reconnectedPort, capacity: 4096, firmwareUpdated: true })
      expect(transferCount).toBe(2)
      expect(flashCount).toBe(1)
      expect(stages).toEqual([
        'checking',
        'transferring',
        'flashing',
        'reconnecting',
        'transferring',
        'ready'
      ])
    }
  })

  test('reports capacity errors without reflashing firmware', async () => {
    let flashCount = 0
    await expect(
      transferUsbContentWithFirmwareFallback(
        {
          port,
          manifestUrl: '/firmware.json',
          transfer: async () => {
            throw new UsbContentFirmwareError('capacity', '内容超过设备容量')
          }
        },
        dependencies(() => {
          flashCount += 1
        })
      )
    ).rejects.toThrow('内容超过设备容量')
    expect(flashCount).toBe(0)
  })

  test('does not refresh firmware when the selected device is temporarily unavailable', async () => {
    let flashCount = 0
    await expect(
      transferUsbContentWithFirmwareFallback(
        {
          port,
          manifestUrl: '/firmware.json',
          transfer: async () => {
            throw new UsbContentDeviceUnavailableError('等待 USB 设备响应超时')
          }
        },
        dependencies(() => {
          flashCount += 1
        })
      )
    ).rejects.toThrow('等待 USB 设备响应超时')
    expect(flashCount).toBe(0)
  })

  test('serializes complete USB deployment transactions', async () => {
    const events: string[] = []
    let releaseFirst: (() => void) | undefined
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const first = transferUsbContentWithFirmwareFallback(
      {
        port,
        manifestUrl: '/firmware.json',
        transfer: async () => {
          events.push('first:start')
          await firstGate
          events.push('first:end')
          return 4096
        }
      },
      dependencies(() => undefined)
    )
    const second = transferUsbContentWithFirmwareFallback(
      {
        port: reconnectedPort,
        manifestUrl: '/firmware.json',
        transfer: async () => {
          events.push('second:start')
          return 4096
        }
      },
      dependencies(() => undefined)
    )

    await Promise.resolve()
    await Promise.resolve()
    expect(events).toEqual(['first:start'])
    releaseFirst?.()
    await Promise.all([first, second])
    expect(events).toEqual(['first:start', 'first:end', 'second:start'])
  })

  test('waits through a transient serial reconnect after flashing', async () => {
    let transferCount = 0
    const result = await transferUsbContentWithFirmwareFallback(
      {
        port,
        manifestUrl: '/firmware.json',
        transfer: async () => {
          transferCount += 1
          if (transferCount === 1) {
            throw new UsbContentFirmwareError('missing', '基础固件缺失')
          }
          if (transferCount === 2) {
            throw new UsbContentDeviceUnavailableError('设备仍在重启')
          }
          return 4096
        }
      },
      dependencies(() => undefined)
    )

    expect(result.firmwareUpdated).toBe(true)
    expect(transferCount).toBe(3)
  })

  test('does not mistake a content rejection for a firmware mismatch', async () => {
    let flashCount = 0
    await expect(
      transferUsbContentWithFirmwareFallback(
        {
          port,
          manifestUrl: '/firmware.json',
          transfer: async () => {
            throw new Error('USB 设备拒绝内容：259 begin')
          }
        },
        dependencies(() => {
          flashCount += 1
        })
      )
    ).rejects.toThrow('USB 设备拒绝内容')
    expect(flashCount).toBe(0)
  })
})
