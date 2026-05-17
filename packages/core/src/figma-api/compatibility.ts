/// <reference types="@figma/plugin-typings" />

import type { FigmaAPI } from './index'

type Expect<T extends true> = T

type IncompatibleKeys<Actual, Expected> = {
  [K in keyof Expected]: K extends keyof Actual ? (Actual[K] extends Expected[K] ? never : K) : K
}[keyof Expected]

export type SupportedPluginAPI = Pick<
  PluginAPI,
  | 'base64Decode'
  | 'base64Encode'
  | 'loadFontAsync'
  | 'notify'
  | 'createComponent'
  | 'createEllipse'
  | 'createFrame'
  | 'createLine'
  | 'createPolygon'
  | 'createRectangle'
  | 'createSection'
  | 'createStar'
  | 'createText'
  | 'createVector'
  | 'exclude'
  | 'flatten'
  | 'group'
  | 'intersect'
  | 'subtract'
  | 'ungroup'
  | 'union'
>

export type FigmaAPIIncompatibleKeys = IncompatibleKeys<FigmaAPI, SupportedPluginAPI>
export type FigmaAPICompatibility = Expect<FigmaAPIIncompatibleKeys extends never ? true : false>
