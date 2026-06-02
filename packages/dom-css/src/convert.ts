import type { SceneGraph } from '@open-pencil/core/scene-graph'

import { createCSSRuntime } from './runtime'
import { compileTailwindCSS, type CompileTailwindCSSOptions } from './tailwind'
import { designDocumentToSceneGraph, type ToSceneGraphOptions } from './to-scene-graph'
import type { CSSComputeOptions, CSSRuntime, DesignDocument } from './types'

export interface HTMLToDesignDocumentOptions {
  cssText?: string
  runtime?: CSSRuntime
  compute?: CSSComputeOptions
}

export interface HTMLToSceneGraphOptions extends HTMLToDesignDocumentOptions, ToSceneGraphOptions {}

export interface TailwindHTMLToDesignDocumentOptions
  extends Omit<HTMLToDesignDocumentOptions, 'cssText'>, CompileTailwindCSSOptions {}

export interface TailwindHTMLToSceneGraphOptions
  extends TailwindHTMLToDesignDocumentOptions, ToSceneGraphOptions {}

function runtimeForOptions(runtime: CSSRuntime | undefined) {
  return runtime ?? createCSSRuntime()
}

export async function htmlToDesignDocument(
  html: string,
  options: HTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const runtime = runtimeForOptions(options.runtime)
  const document = runtime.parseHTML(html)
  return runtime.computeStyles(document, options.cssText, options.compute)
}

export async function htmlToSceneGraph(
  html: string,
  options: HTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await htmlToDesignDocument(html, options)
  return designDocumentToSceneGraph(document, options)
}

export async function tailwindHTMLToDesignDocument(
  html: string,
  candidates: string | Iterable<string>,
  options: TailwindHTMLToDesignDocumentOptions = {}
): Promise<DesignDocument> {
  const cssText = await compileTailwindCSS(candidates, options)
  return htmlToDesignDocument(html, { ...options, cssText })
}

export async function tailwindHTMLToSceneGraph(
  html: string,
  candidates: string | Iterable<string>,
  options: TailwindHTMLToSceneGraphOptions = {}
): Promise<SceneGraph> {
  const document = await tailwindHTMLToDesignDocument(html, candidates, options)
  return designDocumentToSceneGraph(document, options)
}
