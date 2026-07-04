import { twirl } from 'twirlwind'

import type {
  DesignDocument,
  DesignElement,
  DesignNode,
  DesignStyleDeclaration,
  DesignText
} from './types'

export interface SerializeHTMLOptions {
  style?: 'inline' | 'tailwind'
  html?: 'fragment' | 'standalone'
}

const TAILWIND_BROWSER_CDN = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
])

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;')
}

function serializeText(node: DesignText): string {
  return escapeText(node.text)
}

function serializeStyle(node: DesignElement): string | undefined {
  if (!node.inlineStyle || Object.keys(node.inlineStyle).length === 0) return undefined
  return Object.entries(node.inlineStyle)
    .filter(([, value]) => value !== '')
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
}

function serializeTailwindClasses(node: DesignElement): string | undefined {
  const style = serializeStyle(node)
  if (!style) return undefined
  const className = twirl(style)
  return className.length > 0 ? className : undefined
}

function mergeClassNames(...values: Array<string | undefined>): string | undefined {
  const className = values
    .flatMap((value) => value?.split(/\s+/) ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(' ')
  return className.length > 0 ? className : undefined
}

function serializeAttrs(node: DesignElement, options: SerializeHTMLOptions): string {
  const style = serializeStyle(node)
  const tailwindClass = options.style === 'tailwind' ? serializeTailwindClasses(node) : undefined
  const attrsWithoutStyle = { ...node.attrs }
  delete attrsWithoutStyle.style
  const sourceAttrs = options.style === 'tailwind' && tailwindClass ? attrsWithoutStyle : node.attrs
  const attrs = {
    ...sourceAttrs,
    ...(tailwindClass ? { class: mergeClassNames(node.attrs.class, tailwindClass) } : {}),
    ...(style && options.style !== 'tailwind' ? { style } : {})
  }
  const serialized = Object.entries(attrs)
    .filter(([, value]) => value !== '')
    .map(([name, value]) => `${name}="${escapeAttr(value)}"`)

  if (serialized.length === 0) return ''
  return ` ${serialized.join(' ')}`
}

function serializeElement(node: DesignElement, options: SerializeHTMLOptions): string {
  const tagName = node.tagName.toLowerCase()
  const attrs = serializeAttrs(node, options)
  if (VOID_ELEMENTS.has(tagName)) return `<${tagName}${attrs}>`
  return `<${tagName}${attrs}>${node.children.map((child) => serializeNode(child, options)).join('')}</${tagName}>`
}

interface StandaloneBounds {
  minX: number
  minY: number
  width: number
  height: number
}

function standaloneStyleForNode(
  node: DesignElement,
  parent: DesignElement | undefined,
  origin: StandaloneBounds
): DesignStyleDeclaration {
  const style = { ...node.inlineStyle }
  const source = node.sourceSceneNode
  if (!source) return style

  style.position = 'absolute'
  style.left = `${source.x - (parent ? 0 : origin.minX)}px`
  style.top = `${source.y - (parent ? 0 : origin.minY)}px`
  return style
}

function standaloneNode(
  node: DesignNode,
  origin: StandaloneBounds,
  parent?: DesignElement
): DesignNode {
  if (node.type === 'text') return node
  const standalone: DesignElement = {
    ...node,
    inlineStyle: standaloneStyleForNode(node, parent, origin),
    children: []
  }
  standalone.children = node.children.map((child) => standaloneNode(child, origin, node))
  return standalone
}

function nodeBounds(node: DesignNode): StandaloneBounds | undefined {
  if (node.type === 'text' || !node.sourceSceneNode) return undefined
  return {
    minX: node.sourceSceneNode.x,
    minY: node.sourceSceneNode.y,
    width: node.sourceSceneNode.width,
    height: node.sourceSceneNode.height
  }
}

function standaloneSize(document: DesignDocument): StandaloneBounds {
  const bounds = document.children
    .map(nodeBounds)
    .filter((value): value is NonNullable<typeof value> => value !== undefined)
  const minX = bounds.length > 0 ? Math.min(...bounds.map((bound) => bound.minX)) : 0
  const minY = bounds.length > 0 ? Math.min(...bounds.map((bound) => bound.minY)) : 0
  const maxX = bounds.length > 0 ? Math.max(...bounds.map((bound) => bound.minX + bound.width)) : 1
  const maxY = bounds.length > 0 ? Math.max(...bounds.map((bound) => bound.minY + bound.height)) : 1
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
}

function serializeStandaloneHTML(document: DesignDocument, options: SerializeHTMLOptions): string {
  const size = standaloneSize(document)
  const body = document.children
    .map((node) => serializeNode(standaloneNode(node, size), options))
    .join('')
  const stageStyle = `position: relative; width: ${size.width}px; height: ${size.height}px; overflow: hidden; background: transparent`
  const reset =
    '*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#fff}'
  const tailwindBrowser =
    options.style === 'tailwind' ? `<script src="${TAILWIND_BROWSER_CDN}"></script>` : ''
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${tailwindBrowser}<style>${reset}</style></head><body><main data-open-pencil-html="standalone" style="${stageStyle}">${body}</main></body></html>`
}

export function serializeNode(node: DesignNode, options: SerializeHTMLOptions = {}): string {
  return node.type === 'text' ? serializeText(node) : serializeElement(node, options)
}

export function serializeHTML(
  document: DesignDocument,
  options: SerializeHTMLOptions = {}
): string {
  if (options.html === 'standalone') return serializeStandaloneHTML(document, options)
  return document.children.map((node) => serializeNode(node, options)).join('')
}
