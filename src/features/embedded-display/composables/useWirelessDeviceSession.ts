import { ref } from 'vue'

import { probeWirelessDevice, uploadWirelessImage } from '../adapters/wireless'
import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedWirelessDevice
} from '../model/types'

type WirelessSessionStatus = 'idle' | 'checking' | 'uploading' | 'success' | 'error'

interface WirelessSessionOptions {
  defaultBaseUrl: string
  idleMessage: string
  requireStationConnection?: boolean
}

export function useWirelessDeviceSession(options: WirelessSessionOptions) {
  const baseUrl = ref(options.defaultBaseUrl)
  const status = ref<WirelessSessionStatus>('idle')
  const message = ref(options.idleMessage)
  const deviceReady = ref(false)
  const baseFirmwareReady = ref(false)
  const device = ref<EmbeddedWirelessDevice | null>(null)

  function markFirmwareBuilt(nextMessage: string) {
    baseFirmwareReady.value = true
    deviceReady.value = false
    device.value = null
    status.value = 'idle'
    message.value = nextMessage
  }

  function reset(nextMessage = options.idleMessage) {
    baseFirmwareReady.value = false
    deviceReady.value = false
    device.value = null
    status.value = 'idle'
    message.value = nextMessage
  }

  async function probe(profile: EmbeddedDisplayProfile) {
    status.value = 'checking'
    message.value = '正在检查设备连接…'
    try {
      const result = await probeWirelessDevice(baseUrl.value)
      if (
        result.width !== profile.resolution.width ||
        result.height !== profile.resolution.height
      ) {
        throw new Error(
          `设备分辨率为 ${result.width} × ${result.height}，与当前方案 ${profile.resolution.width} × ${profile.resolution.height} 不匹配`
        )
      }
      if (options.requireStationConnection && result.connected !== true) {
        throw new Error('设备尚未成功连接局域网，请检查屏幕上的联网状态')
      }
      device.value = result
      deviceReady.value = true
      baseFirmwareReady.value = true
      status.value = 'success'
      const address = result.ip || result.apIp
      message.value = `设备已连接：${result.width} × ${result.height}${address ? `，地址 ${address}` : ''}`
      return result
    } catch (error) {
      deviceReady.value = false
      device.value = null
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function upload(payload: EmbeddedImagePayload) {
    if (!deviceReady.value) return false
    status.value = 'uploading'
    message.value = '正在传输图片…'
    try {
      await uploadWirelessImage(baseUrl.value, payload)
      status.value = 'success'
      message.value = '图片已传输，设备将重启并加载新内容'
      return true
    } catch (error) {
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  return {
    baseUrl,
    status,
    message,
    deviceReady,
    baseFirmwareReady,
    device,
    markFirmwareBuilt,
    reset,
    probe,
    upload
  }
}
