import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedPrototypePayload
} from '../model/types'
import { encodeWirelessImage, encodeWirelessPrototype } from './wireless-content'
import type { WirelessImageSequencePayload } from './wireless-sequence'

export const OPENPENCIL_BLE_SERVICE_UUID = 'a110207d-8f4d-559b-8e4a-4791892b127d'
export const OPENPENCIL_BLE_TRANSFER_UUID = 'a210207d-8f4d-559b-8e4a-4791892b127d'
export const OPENPENCIL_BLE_STATUS_UUID = 'a310207d-8f4d-559b-8e4a-4791892b127d'

interface BluetoothCharacteristic {
  value?: DataView
  writeValueWithResponse(value: BufferSource): Promise<void>
  writeValueWithoutResponse?(value: BufferSource): Promise<void>
  readValue?(): Promise<DataView>
  startNotifications?(): Promise<BluetoothCharacteristic>
  addEventListener?(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
  removeEventListener?(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
}

interface BluetoothService {
  getCharacteristic(uuid: string): Promise<BluetoothCharacteristic>
}

interface BluetoothGattServer {
  connected: boolean
  connect(): Promise<BluetoothGattServer>
  disconnect(): void
  getPrimaryService(uuid: string): Promise<BluetoothService>
}

interface BluetoothDevice {
  name?: string
  gatt?: BluetoothGattServer
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}

interface BluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      filters: Array<{ services?: string[]; namePrefix?: string }>
      optionalServices?: string[]
    }): Promise<BluetoothDevice>
  }
}

export interface BleTransferProgress {
  receivedBytes: number
  totalBytes: number
  chunkSize: number
  fallbackUsed: boolean
}

export type BleFirmwareMode = 'frame' | 'prototype' | 'unified'

export interface BleTransferStatus {
  connected: boolean
  receiving: boolean
  completed: boolean
  failed: boolean
  receivedBytes: number
  totalBytes: number
  firmwareMode: BleFirmwareMode | null
}

export interface BleDeviceConnection {
  device: BluetoothDevice
  server: BluetoothGattServer
  transfer?: BluetoothCharacteristic
  status?: BluetoothCharacteristic
}

function getBluetooth(): NonNullable<BluetoothNavigator['bluetooth']> {
  const bluetooth = (navigator as BluetoothNavigator).bluetooth
  if (!bluetooth) throw new Error('当前环境不支持 Web Bluetooth，请使用 Chrome 或 Edge')
  return bluetooth
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}
export async function requestOpenPencilBleDevice(): Promise<BluetoothDevice> {
  return getBluetooth().requestDevice({
    filters: [{ namePrefix: 'OpenPencil BLE' }],
    optionalServices: [OPENPENCIL_BLE_SERVICE_UUID]
  })
}

async function discoverOpenPencilBleService(server: BluetoothGattServer) {
  const service = await server.getPrimaryService(OPENPENCIL_BLE_SERVICE_UUID)
  const transfer = await service.getCharacteristic(OPENPENCIL_BLE_TRANSFER_UUID)
  const status = await service.getCharacteristic(OPENPENCIL_BLE_STATUS_UUID)
  return { transfer, status }
}

export async function connectOpenPencilBleDevice(
  device: BluetoothDevice,
  profile: EmbeddedDisplayProfile
): Promise<BleDeviceConnection> {
  if (!device.gatt) throw new Error('BLE 设备缺少 GATT 服务')
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect()
  const characteristics = await discoverOpenPencilBleService(server)
  void profile
  return { device, server, ...characteristics }
}

function readFirmwareMode(value: DataView): BleFirmwareMode | null {
  if (value.byteLength <= 13) return null
  const mode = value.getUint8(13)
  if (mode === 2) return 'unified'
  return mode === 1 ? 'prototype' : 'frame'
}

function parseBleTransferStatus(value: DataView): BleTransferStatus {
  return {
    connected: value.getUint8(0) !== 0,
    receiving: value.getUint8(2) !== 0,
    completed: value.getUint8(3) !== 0,
    failed: value.getUint8(4) !== 0,
    receivedBytes: value.getUint32(5, true),
    totalBytes: value.getUint32(9, true),
    firmwareMode: readFirmwareMode(value)
  }
}

interface BleStatusMonitor {
  waitForProgress(minimumBytes: number, timeoutMs: number): Promise<BleTransferStatus | null>
  dispose(): void
}

async function createBleStatusMonitor(
  status: BluetoothCharacteristic
): Promise<BleStatusMonitor | null> {
  if (!status.startNotifications || !status.addEventListener || !status.removeEventListener)
    return null

  let latestStatus: BleTransferStatus | null = null
  const listeners = new Set<(value: BleTransferStatus) => void>()
  const handleNotification = (event: Event) => {
    const value = (event.target as BluetoothCharacteristic | null)?.value
    if (!value) return
    latestStatus = parseBleTransferStatus(value)
    for (const listener of listeners) listener(latestStatus)
  }

  status.addEventListener('characteristicvaluechanged', handleNotification)
  try {
    await status.startNotifications()
  } catch {
    status.removeEventListener('characteristicvaluechanged', handleNotification)
    return null
  }

  return {
    waitForProgress(minimumBytes, timeoutMs) {
      if (
        latestStatus &&
        (latestStatus.completed || latestStatus.failed || latestStatus.receivedBytes > minimumBytes)
      ) {
        return Promise.resolve(latestStatus)
      }

      return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => {
          listeners.delete(handleStatus)
          resolve(null)
        }, timeoutMs)
        const handleStatus = (nextStatus: BleTransferStatus) => {
          if (
            !nextStatus.completed &&
            !nextStatus.failed &&
            nextStatus.receivedBytes <= minimumBytes
          )
            return
          window.clearTimeout(timeoutId)
          listeners.delete(handleStatus)
          resolve(nextStatus)
        }
        listeners.add(handleStatus)
      })
    },
    dispose() {
      listeners.clear()
      status.removeEventListener?.('characteristicvaluechanged', handleNotification)
    }
  }
}

export async function readBleTransferStatus(
  status: BluetoothCharacteristic
): Promise<BleTransferStatus> {
  if (!status.readValue) throw new Error('BLE 固件不支持状态读取')
  return parseBleTransferStatus(await status.readValue())
}

interface BleUploadState {
  offset: number
  chunkSize: number
  packetsPerCheckpoint: number
  checkpointDelayMs: number
  healthyCheckpoints: number
  stalledCheckpoints: number
  wrotePacket: boolean
  fallbackUsed: boolean
}

async function writeBleWindow(
  transfer: BluetoothCharacteristic,
  bytes: Uint8Array,
  state: BleUploadState
): Promise<void> {
  const fallbackChunkSize = 244
  for (
    let packetIndex = 0;
    packetIndex < state.packetsPerCheckpoint && state.offset < bytes.byteLength;
    packetIndex += 1
  ) {
    const chunk = bytes.slice(
      state.offset,
      Math.min(state.offset + state.chunkSize, bytes.byteLength)
    )
    const packet = new Uint8Array(4 + chunk.byteLength)
    new DataView(packet.buffer).setUint32(0, state.offset, true)
    packet.set(chunk, 4)
    try {
      await transfer.writeValueWithoutResponse?.(packet)
    } catch (error) {
      if (!state.wrotePacket && state.chunkSize > fallbackChunkSize) {
        state.chunkSize = fallbackChunkSize
        state.fallbackUsed = true
        state.packetsPerCheckpoint = 64
        state.checkpointDelayMs = 4
        packetIndex -= 1
        continue
      }
      throw error
    }
    state.wrotePacket = true
    state.offset += chunk.byteLength
  }
}

function updateBleSendWindow(
  state: BleUploadState,
  checkpointStart: number,
  confirmedOffset: number
): void {
  if (confirmedOffset <= checkpointStart) {
    state.healthyCheckpoints = 0
    state.stalledCheckpoints += 1
    state.packetsPerCheckpoint = Math.max(16, Math.floor(state.packetsPerCheckpoint / 2))
    state.checkpointDelayMs = Math.min(20, state.checkpointDelayMs + 4)
    if (state.stalledCheckpoints >= 20) throw new Error('BLE 传输长时间没有进展')
    return
  }

  state.stalledCheckpoints = 0
  state.healthyCheckpoints += 1
  if (state.healthyCheckpoints < 2) return
  state.packetsPerCheckpoint = Math.min(128, state.packetsPerCheckpoint + 16)
  state.checkpointDelayMs = Math.max(2, state.checkpointDelayMs - 1)
  state.healthyCheckpoints = 0
}

async function uploadBleBytes(
  transfer: BluetoothCharacteristic,
  status: BluetoothCharacteristic,
  bytes: Uint8Array,
  onProgress?: (progress: BleTransferProgress) => void,
  startOffset = 0
): Promise<void> {
  if (startOffset < 0 || startOffset > bytes.byteLength) throw new Error('BLE 续传位置无效')
  if (!transfer.writeValueWithoutResponse) throw new Error('当前浏览器不支持 BLE 无响应写入')

  const state: BleUploadState = {
    offset: startOffset,
    chunkSize: 505,
    packetsPerCheckpoint: 48,
    checkpointDelayMs: 4,
    healthyCheckpoints: 0,
    stalledCheckpoints: 0,
    wrotePacket: false,
    fallbackUsed: false
  }
  const statusMonitor = await createBleStatusMonitor(status)

  try {
    while (state.offset < bytes.byteLength) {
      const checkpointStart = state.offset
      await writeBleWindow(transfer, bytes, state)

      let remoteStatus = statusMonitor
        ? await statusMonitor.waitForProgress(checkpointStart, 150)
        : null
      const receivedNotification = remoteStatus !== null
      if (!remoteStatus) {
        await wait(state.checkpointDelayMs)
        remoteStatus = await readBleTransferStatus(status)
      }
      if (remoteStatus.failed) throw new Error('设备拒绝了 BLE 内容数据')
      if (remoteStatus.completed) {
        onProgress?.({
          receivedBytes: bytes.byteLength,
          totalBytes: bytes.byteLength,
          chunkSize: state.chunkSize,
          fallbackUsed: state.fallbackUsed
        })
        return
      }

      const confirmedOffset = Math.min(remoteStatus.receivedBytes, bytes.byteLength)
      updateBleSendWindow(state, checkpointStart, confirmedOffset)

      // Notifications are progress snapshots and may lag behind queued writes.
      // Only a direct status read is authoritative enough to rewind the sender.
      if (!receivedNotification) state.offset = confirmedOffset
      onProgress?.({
        receivedBytes: confirmedOffset,
        totalBytes: bytes.byteLength,
        chunkSize: state.chunkSize,
        fallbackUsed: state.fallbackUsed
      })
    }
  } finally {
    statusMonitor?.dispose()
  }
}

export function uploadBleImage(
  transfer: BluetoothCharacteristic,
  status: BluetoothCharacteristic,
  payload: EmbeddedImagePayload,
  onProgress?: (progress: BleTransferProgress) => void,
  startOffset = 0
): Promise<void> {
  return uploadBleBytes(
    transfer,
    status,
    new Uint8Array(encodeWirelessImage(payload)),
    onProgress,
    startOffset
  )
}

export function uploadBlePrototype(
  transfer: BluetoothCharacteristic,
  status: BluetoothCharacteristic,
  payload: EmbeddedPrototypePayload,
  onProgress?: (progress: BleTransferProgress) => void,
  startOffset = 0
): Promise<void> {
  return uploadBleBytes(
    transfer,
    status,
    new Uint8Array(encodeWirelessPrototype(payload)),
    onProgress,
    startOffset
  )
}

export function uploadBleSequence(
  transfer: BluetoothCharacteristic,
  status: BluetoothCharacteristic,
  payload: WirelessImageSequencePayload,
  onProgress?: (progress: BleTransferProgress) => void,
  startOffset = 0
): Promise<void> {
  return uploadBleBytes(transfer, status, new Uint8Array(payload.content), onProgress, startOffset)
}
