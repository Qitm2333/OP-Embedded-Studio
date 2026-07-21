import { encodeWirelessImage, encodeWirelessPrototype } from './wireless-content'
import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedPrototypePayload
} from '../model/types'

export const OPENPENCIL_BLE_SERVICE_UUID = 'a110207d-8f4d-559b-8e4a-4791892b127d'
export const OPENPENCIL_BLE_TRANSFER_UUID = 'a210207d-8f4d-559b-8e4a-4791892b127d'
export const OPENPENCIL_BLE_STATUS_UUID = 'a310207d-8f4d-559b-8e4a-4791892b127d'

interface BluetoothCharacteristic {
  writeValueWithResponse(value: BufferSource): Promise<void>
  writeValueWithoutResponse?(value: BufferSource): Promise<void>
  readValue?(): Promise<DataView>
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

export async function readBleTransferStatus(status: BluetoothCharacteristic): Promise<BleTransferStatus> {
  if (!status.readValue) throw new Error('BLE 固件不支持状态读取')
  const value = await status.readValue()
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

async function uploadBleBytes(
  transfer: BluetoothCharacteristic,
  status: BluetoothCharacteristic,
  bytes: Uint8Array,
  onProgress?: (progress: BleTransferProgress) => void,
  startOffset = 0
): Promise<void> {
  if (startOffset < 0 || startOffset > bytes.byteLength) throw new Error('BLE 续传位置无效')
  if (!transfer.writeValueWithoutResponse) throw new Error('当前浏览器不支持 BLE 无响应写入')

  const fallbackChunkSize = 244
  let chunkSize = 505
  const minimumPacketsPerCheckpoint = 8
  const maximumPacketsPerCheckpoint = 48
  let packetsPerCheckpoint = 24
  let checkpointDelayMs = 4
  let healthyCheckpoints = 0
  let stalledCheckpoints = 0
  let wrotePacket = false
  let offset = startOffset

  while (offset < bytes.byteLength) {
    const checkpointStart = offset
    for (let packetIndex = 0; packetIndex < packetsPerCheckpoint && offset < bytes.byteLength; packetIndex += 1) {
      const chunk = bytes.slice(offset, Math.min(offset + chunkSize, bytes.byteLength))
      const packet = new Uint8Array(4 + chunk.byteLength)
      new DataView(packet.buffer).setUint32(0, offset, true)
      packet.set(chunk, 4)
      try {
        await transfer.writeValueWithoutResponse(packet)
      } catch (error) {
        if (!wrotePacket && chunkSize > fallbackChunkSize) {
          chunkSize = fallbackChunkSize
          packetsPerCheckpoint = 16
          checkpointDelayMs = 6
          continue
        }
        throw error
      }
      wrotePacket = true
      offset += chunk.byteLength
    }

    await wait(checkpointDelayMs)
    const remoteStatus = await readBleTransferStatus(status)
    if (remoteStatus.failed) throw new Error('设备拒绝了 BLE 内容数据')
    if (remoteStatus.completed) {
      onProgress?.({ receivedBytes: bytes.byteLength, totalBytes: bytes.byteLength })
      return
    }

    const confirmedOffset = Math.min(remoteStatus.receivedBytes, bytes.byteLength)
    if (confirmedOffset <= checkpointStart) {
      healthyCheckpoints = 0
      stalledCheckpoints += 1
      packetsPerCheckpoint = Math.max(
        minimumPacketsPerCheckpoint,
        Math.floor(packetsPerCheckpoint / 2)
      )
      checkpointDelayMs = Math.min(20, checkpointDelayMs + 4)
      if (stalledCheckpoints >= 20) throw new Error('BLE 传输长时间没有进展')
    } else {
      stalledCheckpoints = 0
      healthyCheckpoints += 1
      if (healthyCheckpoints >= 3) {
        packetsPerCheckpoint = Math.min(maximumPacketsPerCheckpoint, packetsPerCheckpoint + 8)
        checkpointDelayMs = Math.max(3, checkpointDelayMs - 1)
        healthyCheckpoints = 0
      }
    }

    // If the device confirmed less than we sent, queued packets after the gap
    // are harmless duplicates or rejected by the offset check; resend from the
    // confirmed contiguous position.
    offset = confirmedOffset
    onProgress?.({ receivedBytes: confirmedOffset, totalBytes: bytes.byteLength })
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
