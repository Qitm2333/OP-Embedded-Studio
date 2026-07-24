import { computed, onMounted, onUnmounted, ref } from 'vue'

import { readCacheText, writeCacheText } from '@/app/cache'

import { requestSerialPort, type SerialPortLike } from '../adapters/serial-flasher'

type SerialSessionStatus =
  | 'idle'
  | 'restoring'
  | 'selecting'
  | 'ready'
  | 'disconnected'
  | 'error'

interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialPortWithInfo {
  getInfo?: () => SerialPortInfo
}

interface WebSerialApi extends EventTarget {
  getPorts?: () => Promise<SerialPortLike[]>
}

const STORAGE_KEY = 'embedded-display/serial-device'

function serialApi(): WebSerialApi | null {
  return (
    navigator as Navigator & {
      serial?: WebSerialApi
    }
  ).serial ?? null
}

function portInfo(port: SerialPortLike): SerialPortInfo {
  return (port as SerialPortLike & SerialPortWithInfo).getInfo?.() ?? {}
}

function deviceIdentity(port: SerialPortLike): string {
  const info = portInfo(port)
  return [info.usbVendorId ?? '', info.usbProductId ?? ''].join(':')
}

function hexId(value: number | undefined): string {
  return value === undefined ? '????' : value.toString(16).toUpperCase().padStart(4, '0')
}

function deviceLabel(port: SerialPortLike): string {
  const info = portInfo(port)
  return 'USB 串口 · ' + hexId(info.usbVendorId) + ':' + hexId(info.usbProductId)
}

export function useSerialDeviceSession() {
  const port = ref<SerialPortLike | null>(null)
  const status = ref<SerialSessionStatus>('idle')
  const message = ref('尚未选择串口设备')
  const label = ref('未选择串口')
  const supported = computed(() => Boolean(serialApi()))
  const ready = computed(() => status.value === 'ready' && Boolean(port.value))
  const selecting = computed(() => status.value === 'selecting')

  function remember(selectedPort: SerialPortLike) {
    const identity = deviceIdentity(selectedPort)
    if (identity !== ':') void writeCacheText(STORAGE_KEY, identity)
  }

  function usePort(selectedPort: SerialPortLike, restored: boolean) {
    port.value = selectedPort
    label.value = deviceLabel(selectedPort)
    status.value = 'ready'
    message.value = restored
      ? '已恢复之前授权的串口；烧录时将自动使用'
      : '串口已记住；后续烧录不再重复选择'
    remember(selectedPort)
  }

  async function restoreAuthorizedPort(): Promise<SerialPortLike | null> {
    const api = serialApi()
    if (!api) {
      status.value = 'error'
      message.value = '当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge'
      return null
    }
    if (!api.getPorts) return port.value

    status.value = port.value ? status.value : 'restoring'
    try {
      const authorizedPorts = await api.getPorts()
      const rememberedIdentity = await readCacheText(STORAGE_KEY)
      const restoredPort =
        authorizedPorts.find((candidate) => deviceIdentity(candidate) === rememberedIdentity) ??
        (authorizedPorts.length === 1 ? authorizedPorts[0] : null)
      if (restoredPort) {
        usePort(restoredPort, true)
        return restoredPort
      }
      if (!port.value) {
        status.value = 'idle'
        label.value = '未选择串口'
        message.value = authorizedPorts.length
          ? '检测到多个已授权串口，请确认要使用的设备'
          : '首次使用请先选择串口设备'
      }
      return port.value
    } catch (error) {
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function selectPort(): Promise<SerialPortLike | null> {
    status.value = 'selecting'
    message.value = '请在浏览器窗口中选择 ESP32 串口设备'
    try {
      const selectedPort = await requestSerialPort()
      usePort(selectedPort, false)
      return selectedPort
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : ''
      if (errorName === 'NotFoundError') {
        status.value = port.value ? 'ready' : 'idle'
        message.value = port.value ? '已保留原串口设备' : '已取消串口选择'
        return port.value
      }
      status.value = 'error'
      message.value = error instanceof Error ? error.message : String(error)
      return null
    }
  }

  async function requirePort(): Promise<SerialPortLike> {
    if (port.value) return port.value
    const selectedPort = await selectPort()
    if (!selectedPort) throw new Error('尚未选择可用的串口设备')
    return selectedPort
  }

  function handleDisconnect(event: Event) {
    const api = serialApi()
    const disconnectedPort =
      (event as Event & { port?: SerialPortLike }).port ??
      (event.target !== api ? (event.target as SerialPortLike) : null)
    if (disconnectedPort && disconnectedPort !== port.value) return
    port.value = null
    status.value = 'disconnected'
    message.value = '串口设备已断开；重新插入后会尝试自动恢复'
  }

  function handleConnect() {
    void restoreAuthorizedPort()
  }

  onMounted(() => {
    const api = serialApi()
    api?.addEventListener('connect', handleConnect)
    api?.addEventListener('disconnect', handleDisconnect)
    void restoreAuthorizedPort()
  })

  onUnmounted(() => {
    const api = serialApi()
    api?.removeEventListener('connect', handleConnect)
    api?.removeEventListener('disconnect', handleDisconnect)
  })

  return {
    port,
    status,
    message,
    label,
    supported,
    ready,
    selecting,
    selectPort,
    requirePort,
    restoreAuthorizedPort
  }
}
