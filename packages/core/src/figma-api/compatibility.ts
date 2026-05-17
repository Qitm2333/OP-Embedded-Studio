/// <reference types="@figma/plugin-typings" />

import type { FigmaAPI } from './index'

type Expect<T extends true> = T

type IsAssignable<Actual, Expected> = Actual extends Expected ? true : false

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
>

export type FigmaAPICompatibility = Expect<IsAssignable<FigmaAPI, SupportedPluginAPI>>
