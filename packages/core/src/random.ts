export function randomHex(bytes = 16): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  let hex = ''
  for (const b of buf) hex += b.toString(16).padStart(2, '0')
  return hex
}

export function randomInt(): number {
  return crypto.getRandomValues(new Int32Array(1))[0]
}

export function randomIndex(length: number): number {
  return crypto.getRandomValues(new Uint8Array(1))[0] % length
}
