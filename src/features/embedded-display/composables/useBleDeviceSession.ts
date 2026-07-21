import { computed, ref } from 'vue'

import {
  connectOpenPencilBleDevice,
  readBleTransferStatus,
  requestOpenPencilBleDevice,
  uploadBleImage
} from '../adapters/ble'
import type { EmbeddedDisplayProfile, EmbeddedImagePayload } from '../model/types'

type BleSessionStatus = 'idle' | 'checking' | 'uploading' | 'success' | 'error'
type BleDevice = Awaited<ReturnType<typeof requestOpenPencilBleDevice>>
type BleConnection = Awaited<ReturnType<typeof connectOpenPencilBleDevice>>

function isDisconnectedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /disconnected|not connected|gatt server/i.test(message)
}

function waitBeforeReconnect(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 500))
}

export function useBleDeviceSession() {
  const status = ref<BleSessionStatus>('idle')
  const message = ref('???? BLE ??')
  const deviceReady = ref(false)
  const baseFirmwareReady = ref(false)
  const connectedDevice = ref<BleConnection | null>(null)
  const selectedDevice = ref<BleDevice | null>(null)
  const selectedProfile = ref<EmbeddedDisplayProfile | null>(null)
  const progress = ref(0)
  const canReconnect = computed(() => Boolean(selectedDevice.value && selectedProfile.value))
  const monitoredDevices = new WeakSet<object>()

  function setBaseFirmwareReady(ready: boolean) {
    baseFirmwareReady.value = ready
    if (ready && status.value === 'idle') {
      message.value = '?????? BLE ?????????'
    }
  }

  function markFirmwareBuilt(nextMessage: string) {
    baseFirmwareReady.value = true
    deviceReady.value = false
    connectedDevice.value = null
    progress.value = 0
    status.value = 'idle'
    message.value = nextMessage
  }

  function reset(nextMessage = '???? BLE ??') {
    connectedDevice.value?.server.disconnect()
    baseFirmwareReady.value = false
    deviceReady.value = false
    connectedDevice.value = null
    selectedDevice.value = null
    selectedProfile.value = null
    progress.value = 0
    status.value = 'idle'
    message.value = nextMessage
  }

  function monitorDisconnect(device: BleDevice) {
    if (monitoredDevices.has(device)) return
    monitoredDevices.add(device)
    device.addEventListener('gattserverdisconnected', () => {
      deviceReady.value = false
      connectedDevice.value = null
      if (status.value !== 'uploading') status.value = 'idle'
      message.value = 'BLE ????????????????'
    })
  }

  async function connectSelectedDevice(): Promise<BleConnection | null> {
    const device = selectedDevice.value
    const profile = selectedProfile.value
    if (!device || !profile) return null

    try {
      const connection = await connectOpenPencilBleDevice(device, profile)
      connectedDevice.value = connection
      deviceReady.value = connection.server.connected
      baseFirmwareReady.value = true
      monitorDisconnect(device)
      return connection
    } catch (error) {
      connectedDevice.value = null
      deviceReady.value = false
      message.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function probe(profile: EmbeddedDisplayProfile) {
    status.value = 'checking'
    message.value = '?????? BLE ???'
    try {
      const device = await requestOpenPencilBleDevice()
      selectedDevice.value = device
      selectedProfile.value = profile
      const connection = await connectSelectedDevice()
      if (!connection) {
        status.value = 'error'
        return null
      }
      status.value = 'success'
      message.value = connection.transfer
        ? `????${device.name || 'OpenPencil BLE'}?????`
        : `????${device.name || 'OpenPencil BLE'}????????`
      return connection
    } catch (error) {
      deviceReady.value = false
      connectedDevice.value = null
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function upload(payload: EmbeddedImagePayload) {
    if (!selectedDevice.value || !selectedProfile.value) {
      status.value = 'error'
      message.value = '??????? BLE ??'
      return false
    }

    progress.value = 0
    let resumeOffset = 0
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let connection = connectedDevice.value
      if (!connection?.server.connected) {
        status.value = 'checking'
        message.value = attempt === 0 ? '???? BLE ???' : `???????? ${attempt} ??????`
        await waitBeforeReconnect()
        connection = await connectSelectedDevice()
      }
      if (!connection?.server.connected || !connection.transfer || !connection.status) {
        connectedDevice.value = null
        deviceReady.value = false
        continue
      }

      if (attempt > 0) {
        try {
          const remoteStatus = await readBleTransferStatus(connection.status)
          if (remoteStatus.failed) throw new Error('???? BLE ????')
          if (remoteStatus.completed) {
            progress.value = 100
            status.value = 'success'
            message.value = '??????????'
            return true
          }
          resumeOffset = remoteStatus.receivedBytes
        } catch (error) {
          if (isDisconnectedError(error)) {
            connectedDevice.value = null
            deviceReady.value = false
            continue
          }
          status.value = 'error'
          message.value = error instanceof Error ? error.message : String(error)
          return false
        }
      }

      status.value = 'uploading'
      try {
        await uploadBleImage(connection.transfer, connection.status, payload, ({ receivedBytes, totalBytes }) => {
          progress.value = totalBytes ? Math.round((receivedBytes / totalBytes) * 100) : 0
          message.value = `BLE ?????${progress.value}%`
        }, resumeOffset)
        await new Promise((resolve) => window.setTimeout(resolve, 300))
        const finalStatus = await readBleTransferStatus(connection.status)
        if (!finalStatus.completed) throw new Error('BLE ???????????????')
        progress.value = 100
        status.value = 'success'
        message.value = '??????????'
        return true
      } catch (error) {
        if (isDisconnectedError(error)) {
          connectedDevice.value = null
          deviceReady.value = false
          message.value = 'BLE ???????????????'
          continue
        }
        status.value = 'error'
        message.value = error instanceof Error ? error.message : String(error)
        return false
      }
    }

    status.value = 'error'
    message.value = 'BLE ????????????'
    return false
  }

  return {
    status,
    message,
    deviceReady,
    baseFirmwareReady,
    progress,
    canReconnect,
    setBaseFirmwareReady,
    markFirmwareBuilt,
    reset,
    probe,
    upload
  }
}
