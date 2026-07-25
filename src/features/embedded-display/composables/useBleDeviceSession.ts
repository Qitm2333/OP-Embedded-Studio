import { computed, ref } from 'vue'

import {
  connectOpenPencilBleDevice,
  readBleTransferStatus,
  requestOpenPencilBleDevice,
  uploadBleImage,
  uploadBlePrototype,
  uploadBleSequence
} from '../adapters/ble'
import type { BleFirmwareMode, BleTransferProgress } from '../adapters/ble'
import type { WirelessImageSequencePayload } from '../adapters/wireless-sequence'
import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedPrototypePayload
} from '../model/types'

type BleSessionStatus = 'idle' | 'checking' | 'uploading' | 'success' | 'error'
type BleDevice = Awaited<ReturnType<typeof requestOpenPencilBleDevice>>
type BleConnection = Awaited<ReturnType<typeof connectOpenPencilBleDevice>>
type ActiveBleConnection = BleConnection & Required<Pick<BleConnection, 'transfer' | 'status'>>

function isActiveBleConnection(
  connection: BleConnection | null
): connection is ActiveBleConnection {
  return Boolean(connection?.server.connected && connection.transfer && connection.status)
}

function isDisconnectedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /disconnected|not connected|gatt server/i.test(message)
}

function waitBeforeReconnect(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 500)
  })
}

type BleUploadPayload =
  | EmbeddedImagePayload
  | EmbeddedPrototypePayload
  | WirelessImageSequencePayload

function payloadFirmwareMode(payload: BleUploadPayload): BleFirmwareMode {
  return 'states' in payload ? 'prototype' : 'frame'
}

function firmwareModeLabel(mode: BleFirmwareMode): string {
  if (mode === 'unified') return '通用'
  return mode === 'prototype' ? '状态机' : '单 Frame'
}

function uploadBleContent(
  connection: ActiveBleConnection,
  payload: BleUploadPayload,
  onProgress: (progress: BleTransferProgress) => void,
  startOffset: number
): Promise<void> {
  if ('states' in payload) {
    return uploadBlePrototype(
      connection.transfer,
      connection.status,
      payload,
      onProgress,
      startOffset
    )
  }
  if ('content' in payload) {
    return uploadBleSequence(
      connection.transfer,
      connection.status,
      payload,
      onProgress,
      startOffset
    )
  }
  return uploadBleImage(connection.transfer, connection.status, payload, onProgress, startOffset)
}

function createBleTransferMetrics(onUpdate: (message: string, percent: number) => void) {
  let startedAt = 0
  let previousSampleAt = 0
  let previousReceivedBytes = 0
  let totalReceivedBytes = 0
  let chunkSize = 0
  let fallbackUsed = false

  return {
    begin(resumeOffset: number) {
      if (startedAt) return
      startedAt = performance.now()
      previousSampleAt = startedAt
      previousReceivedBytes = resumeOffset
    },
    update: (transferProgress: BleTransferProgress) => {
      const now = performance.now()
      const sampleSeconds = (now - previousSampleAt) / 1000
      const currentRateKbps =
        sampleSeconds > 0
          ? Math.round(
              Math.max(0, transferProgress.receivedBytes - previousReceivedBytes) /
                1024 /
                sampleSeconds
            )
          : 0
      totalReceivedBytes = transferProgress.receivedBytes
      chunkSize = transferProgress.chunkSize
      fallbackUsed = transferProgress.fallbackUsed
      previousSampleAt = now
      previousReceivedBytes = transferProgress.receivedBytes
      const percent = transferProgress.totalBytes
        ? Math.round((transferProgress.receivedBytes / transferProgress.totalBytes) * 100)
        : 0
      onUpdate(
        '正在通过 BLE 传输：' +
          percent +
          '% · ' +
          currentRateKbps +
          ' KB/s · ' +
          chunkSize +
          'B/包' +
          (fallbackUsed ? '（兼容模式）' : ''),
        percent
      )
    },
    complete(): string {
      const totalSeconds = startedAt ? (performance.now() - startedAt) / 1000 : 0
      const averageRateKbps =
        totalSeconds > 0 ? Math.round(totalReceivedBytes / 1024 / totalSeconds) : 0
      return (
        '内容传输完成，平均 ' +
        averageRateKbps +
        ' KB/s · ' +
        chunkSize +
        'B/包' +
        (fallbackUsed ? '（兼容模式）' : '') +
        '；设备正在重启'
      )
    }
  }
}

function createBleDeviceSession() {
  const status = ref<BleSessionStatus>('idle')
  const message = ref('尚未连接 BLE 设备')
  const deviceReady = ref(false)
  const baseFirmwareReady = ref(false)
  const firmwareMode = ref<BleFirmwareMode | null>(null)
  const connectedDevice = ref<BleConnection | null>(null)
  const selectedDevice = ref<BleDevice | null>(null)
  const selectedProfile = ref<EmbeddedDisplayProfile | null>(null)
  const progress = ref(0)
  const canReconnect = computed(() => Boolean(selectedDevice.value && selectedProfile.value))
  const deviceName = computed(() => selectedDevice.value?.name || 'OP Embedded BLE')
  const monitoredDevices = new WeakSet<object>()

  function setBaseFirmwareReady(ready: boolean) {
    baseFirmwareReady.value = ready
    if (ready && status.value === 'idle') {
      message.value = '已找到 BLE 基础固件，可连接设备或通过 USB 重新烧录'
    }
  }

  function markFirmwareBuilt(nextMessage: string) {
    baseFirmwareReady.value = true
    progress.value = 0
    status.value = deviceReady.value ? 'success' : 'idle'
    message.value = nextMessage
  }

  function setProfile(profile: EmbeddedDisplayProfile | null) {
    selectedProfile.value = profile
  }

  function disconnect(nextMessage = '尚未连接 BLE 设备') {
    connectedDevice.value?.server.disconnect()
    baseFirmwareReady.value = false
    deviceReady.value = false
    firmwareMode.value = null
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
      if (selectedDevice.value !== device) return
      deviceReady.value = false
      firmwareMode.value = null
      connectedDevice.value = null
      if (status.value === 'success') {
        message.value = '传输完成，设备已重启；下次上传时重新连接即可'
        return
      }
      if (status.value === 'uploading') {
        message.value = 'BLE 连接中断，正在准备断点续传…'
        return
      }
      status.value = 'idle'
      message.value = 'BLE 设备已断开，可点击连接按钮重新连接'
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

  async function probe(profile: EmbeddedDisplayProfile, expectedMode?: BleFirmwareMode) {
    status.value = 'checking'
    message.value = '正在等待选择 BLE 设备…'
    try {
      const previousDevice = selectedDevice.value
      const previousConnection = connectedDevice.value
      const device = await requestOpenPencilBleDevice()
      selectedDevice.value = device
      selectedProfile.value = profile
      if (previousDevice && previousDevice !== device) previousConnection?.server.disconnect()
      const connection = await connectSelectedDevice()
      if (!isActiveBleConnection(connection)) {
        status.value = 'error'
        message.value = '已连接设备，但 BLE 固件不支持内容传输'
        return null
      }
      const remoteStatus = await readBleTransferStatus(connection.status)
      firmwareMode.value = remoteStatus.firmwareMode
      if (
        expectedMode &&
        remoteStatus.firmwareMode &&
        remoteStatus.firmwareMode !== 'unified' &&
        remoteStatus.firmwareMode !== expectedMode
      ) {
        status.value = 'error'
        message.value =
          '当前设备运行 BLE ' +
          firmwareModeLabel(remoteStatus.firmwareMode) +
          ' 基础固件；请通过 USB 初始化 BLE ' +
          firmwareModeLabel(expectedMode) +
          ' 基础固件'
        return connection
      }
      status.value = 'success'
      message.value = remoteStatus.firmwareMode
        ? '已连接 ' +
          (device.name || 'OP Embedded BLE') +
          '，固件模式：' +
          firmwareModeLabel(remoteStatus.firmwareMode)
        : '已连接 ' +
          (device.name || 'OP Embedded BLE') +
          '，建议重新初始化基础固件以启用模式检测'
      return connection
    } catch (error) {
      deviceReady.value = false
      firmwareMode.value = null
      connectedDevice.value = null
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function checkFirmwareMode(
    connection: ActiveBleConnection,
    expectedMode: BleFirmwareMode
  ): Promise<'ready' | 'disconnected' | 'error'> {
    try {
      const modeStatus = await readBleTransferStatus(connection.status)
      firmwareMode.value = modeStatus.firmwareMode
      if (
        !modeStatus.firmwareMode ||
        modeStatus.firmwareMode === 'unified' ||
        modeStatus.firmwareMode === expectedMode
      )
        return 'ready'
      status.value = 'error'
      message.value =
        '当前设备运行 BLE ' +
        firmwareModeLabel(modeStatus.firmwareMode) +
        ' 基础固件，不能接收 ' +
        firmwareModeLabel(expectedMode) +
        ' 内容；请先通过 USB 初始化正确的基础固件'
      return 'error'
    } catch (error) {
      if (isDisconnectedError(error)) return 'disconnected'
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return 'error'
    }
  }

  async function upload(payload: BleUploadPayload) {
    if (!selectedDevice.value || !selectedProfile.value) {
      status.value = 'error'
      message.value = '请先连接 BLE 设备'
      return false
    }

    const expectedMode = payloadFirmwareMode(payload)
    progress.value = 0
    const transferMetrics = createBleTransferMetrics((nextMessage, nextProgress) => {
      message.value = nextMessage
      progress.value = nextProgress
    })
    let resumeOffset = 0
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let connection = connectedDevice.value
      if (!connection?.server.connected) {
        status.value = 'checking'
        message.value =
          attempt === 0 ? '正在重新连接 BLE 设备…' : '连接中断，正在进行第 ' + attempt + ' 次续传…'
        await waitBeforeReconnect()
        connection = await connectSelectedDevice()
      }
      if (!isActiveBleConnection(connection)) {
        connectedDevice.value = null
        deviceReady.value = false
        continue
      }

      const modeCheck = await checkFirmwareMode(connection, expectedMode)
      if (modeCheck === 'disconnected') {
        connectedDevice.value = null
        deviceReady.value = false
        continue
      }
      if (modeCheck === 'error') return false

      if (attempt > 0) {
        try {
          const remoteStatus = await readBleTransferStatus(connection.status)
          if (remoteStatus.failed) throw new Error('设备拒绝继续 BLE 传输')
          if (remoteStatus.completed) {
            progress.value = 100
            status.value = 'success'
            message.value = '内容传输完成，设备正在重启'
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
      transferMetrics.begin(resumeOffset)
      try {
        await uploadBleContent(connection, payload, transferMetrics.update, resumeOffset)
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 300)
        })
        const finalStatus = await readBleTransferStatus(connection.status)
        if (!finalStatus.completed) throw new Error('BLE 数据已发送，但设备尚未确认完成')
        progress.value = 100
        status.value = 'success'
        message.value = transferMetrics.complete()
        return true
      } catch (error) {
        if (isDisconnectedError(error)) {
          connectedDevice.value = null
          deviceReady.value = false
          message.value = 'BLE 连接中断，正在尝试断点续传…'
          continue
        }
        status.value = 'error'
        message.value = error instanceof Error ? error.message : String(error)
        return false
      }
    }

    status.value = 'error'
    message.value = 'BLE 多次重连失败，请重新连接设备后再试'
    return false
  }

  return {
    status,
    message,
    deviceReady,
    deviceName,
    baseFirmwareReady,
    firmwareMode,
    progress,
    canReconnect,
    setBaseFirmwareReady,
    markFirmwareBuilt,
    setProfile,
    disconnect,
    probe,
    upload
  }
}

const bleDeviceSession = createBleDeviceSession()

export function useBleDeviceSession() {
  return bleDeviceSession
}
