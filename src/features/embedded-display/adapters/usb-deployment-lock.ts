import type { UsbContentSerialPort } from './usb-content-transfer'

let usbOperationQueue: Promise<void> = Promise.resolve()
let activeUsbPort: UsbContentSerialPort | null = null
const verifiedFirmwareProfiles = new WeakMap<object, Set<string>>()

export function withUsbDeploymentLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = usbOperationQueue.then(operation)
  usbOperationQueue = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

export function setActiveUsbPort(port: UsbContentSerialPort): void {
  activeUsbPort = port
}

export function getActiveUsbPort(): UsbContentSerialPort | null {
  return activeUsbPort
}

export function clearActiveUsbPort(port?: UsbContentSerialPort): void {
  if (!port || activeUsbPort === port) activeUsbPort = null
}

export function rememberUsbFirmwareForPort(
  profileId: string,
  port: UsbContentSerialPort | null = activeUsbPort
): void {
  if (!port) return
  const profiles = verifiedFirmwareProfiles.get(port) ?? new Set<string>()
  profiles.add(profileId)
  verifiedFirmwareProfiles.set(port, profiles)
}

export function hasRememberedUsbFirmware(
  profileId: string,
  port: UsbContentSerialPort | null = activeUsbPort
): boolean {
  return Boolean(port && verifiedFirmwareProfiles.get(port)?.has(profileId))
}
