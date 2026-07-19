export default function decodeBase64(value: string): string {
  return globalThis.atob(value)
}
