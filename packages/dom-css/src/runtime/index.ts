import type { CssRuntime } from '../types'
import { createBrowserCssRuntime } from './browser'
import { createHeadlessCssRuntime } from './headless'

export { createBrowserCssRuntime } from './browser'
export { createHeadlessCssRuntime } from './headless'

export function createCssRuntime(): CssRuntime {
  return typeof document !== 'undefined' ? createBrowserCssRuntime() : createHeadlessCssRuntime()
}
