import { describe, expect, it } from 'bun:test'

import { FIG_PACKAGE_STATUS, assertFigPackageReady } from '../src/index'

describe('@open-pencil/fig package shell', () => {
  it('exports scaffold status', () => {
    expect(FIG_PACKAGE_STATUS).toBe('scaffold')
  })

  it('directs consumers to core until behavior moves', () => {
    expect(() => assertFigPackageReady()).toThrow('@open-pencil/fig is scaffolded')
  })
})
