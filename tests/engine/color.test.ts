import { describe, test, expect } from 'bun:test'

import {
  parseColor,
  colorToHex,
  colorToHexRaw,
  colorToRgba255,
  colorToCSS
} from '@open-pencil/core'

describe('parseColor', () => {
  test('hex 6-digit', () => {
    const c = parseColor('#FF0000')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
    expect(c.a).toBe(1)
  })

  test('hex 3-digit', () => {
    const c = parseColor('#f00')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
  })

  test('hex 8-digit with alpha', () => {
    const c = parseColor('#FF000080')
    expect(c.r).toBeCloseTo(1)
    expect(c.a).toBeCloseTo(0.5, 1)
  })

  test('rgb()', () => {
    const c = parseColor('rgb(255, 0, 0)')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(0)
    expect(c.b).toBeCloseTo(0)
    expect(c.a).toBe(1)
  })

  test('rgba()', () => {
    const c = parseColor('rgba(255, 0, 0, 0.5)')
    expect(c.r).toBeCloseTo(1)
    expect(c.a).toBeCloseTo(0.5)
  })

  test('named color', () => {
    const c = parseColor('blue')
    expect(c.b).toBeCloseTo(1)
    expect(c.r).toBeCloseTo(0)
    expect(c.a).toBe(1)
  })

  test('white', () => {
    const c = parseColor('#FFFFFF')
    expect(c.r).toBeCloseTo(1)
    expect(c.g).toBeCloseTo(1)
    expect(c.b).toBeCloseTo(1)
  })

  test('invalid returns black fallback', () => {
    const c = parseColor('invalid')
    expect(c.r).toBe(0)
    expect(c.g).toBe(0)
    expect(c.b).toBe(0)
    expect(c.a).toBe(1)
  })

  test('empty string returns black fallback', () => {
    const c = parseColor('')
    expect(c.r).toBe(0)
    expect(c.g).toBe(0)
    expect(c.b).toBe(0)
  })
})

describe('colorToHex', () => {
  test('red', () => {
    expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#FF0000')
  })

  test('black', () => {
    expect(colorToHex({ r: 0, g: 0, b: 0, a: 1 })).toBe('#000000')
  })

  test('white', () => {
    expect(colorToHex({ r: 1, g: 1, b: 1, a: 1 })).toBe('#FFFFFF')
  })
})

describe('colorToHexRaw', () => {
  test('strips # prefix', () => {
    expect(colorToHexRaw({ r: 1, g: 0, b: 0, a: 1 })).toBe('FF0000')
  })
})

describe('colorToRgba255', () => {
  test('converts 0-1 to 0-255', () => {
    const result = colorToRgba255({ r: 1, g: 0.5, b: 0, a: 0.8 })
    expect(result.r).toBe(255)
    expect(result.g).toBe(128)
    expect(result.b).toBe(0)
    expect(result.a).toBe(0.8)
  })
})

describe('colorToCSS', () => {
  test('opaque uses rgb()', () => {
    const result = colorToCSS({ r: 1, g: 0, b: 0, a: 1 })
    expect(result).toBe('rgb(255, 0, 0)')
  })

  test('transparent uses rgba()', () => {
    const result = colorToCSS({ r: 1, g: 0, b: 0, a: 0.5 })
    expect(result).toBe('rgba(255, 0, 0, 0.5)')
  })
})
