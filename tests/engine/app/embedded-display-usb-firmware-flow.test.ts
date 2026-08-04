import { describe, expect, test } from 'bun:test'

import {
  ensureUsbContentFirmware,
  type UsbContentFirmwareDependencies,
  type UsbContentFirmwareStage
} from '@/features/embedded-display/adapters/usb-content-firmware'
import type { UsbContentSerialPort } from '@/features/embedded-display/adapters/usb-content-transfer'

const port = {} as UsbContentSerialPort
const reconnectedPort = {} as UsbContentSerialPort

function dependencies(
  probeResults: Array<
    | { compatible: true; capacity: number }
    | {
        compatible: false
        issue: 'missing' | 'protocol' | 'resolution' | 'capacity'
        message: string
      }
  >,
  onFlash: () => void
): UsbContentFirmwareDependencies {
  let probeIndex = 0
  return {
    probeDevice: async () => probeResults[Math.min(probeIndex++, probeResults.length - 1)],
    flashManifest: async () => onFlash(),
    getAuthorizedPort: async () => reconnectedPort,
    delay: async () => undefined,
    reconnectAttempts: 3,
    reconnectDelayMs: 0
  }
}

describe('USB automatic firmware flow', () => {
  test('skips firmware flashing when the device is compatible', async () => {
    let flashCount = 0
    const stages: UsbContentFirmwareStage[] = []
    const result = await ensureUsbContentFirmware(
      {
        port,
        manifestUrl: '/firmware.json',
        resolution: { width: 466, height: 466 },
        contentBytes: 1024,
        onStage: (stage) => stages.push(stage)
      },
      dependencies([{ compatible: true, capacity: 4096 }], () => {
        flashCount += 1
      })
    )

    expect(result).toEqual({ port, capacity: 4096, firmwareUpdated: false })
    expect(flashCount).toBe(0)
    expect(stages).toEqual(['checking', 'ready'])
  })

  test('flashes every recoverable mismatch, reconnects, and returns the content port', async () => {
    for (const issue of ['missing', 'protocol', 'resolution'] as const) {
      let flashCount = 0
      const stages: UsbContentFirmwareStage[] = []
      const result = await ensureUsbContentFirmware(
        {
          port,
          manifestUrl: '/firmware.json',
          resolution: { width: 466, height: 466 },
          contentBytes: 1024,
          onStage: (stage) => stages.push(stage)
        },
        dependencies(
          [
            { compatible: false, issue, message: `固件问题：${issue}` },
            { compatible: true, capacity: 4096 }
          ],
          () => {
            flashCount += 1
          }
        )
      )

      expect(result).toEqual({ port: reconnectedPort, capacity: 4096, firmwareUpdated: true })
      expect(flashCount).toBe(1)
      expect(stages).toEqual(['checking', 'flashing', 'reconnecting', 'ready'])
    }
  })

  test('reports capacity errors without reflashing firmware', async () => {
    let flashCount = 0
    await expect(
      ensureUsbContentFirmware(
        {
          port,
          manifestUrl: '/firmware.json',
          resolution: { width: 466, height: 466 },
          contentBytes: 8192
        },
        dependencies(
          [{ compatible: false, issue: 'capacity', message: '内容超过设备容量' }],
          () => {
            flashCount += 1
          }
        )
      )
    ).rejects.toThrow('内容超过设备容量')
    expect(flashCount).toBe(0)
  })
})
