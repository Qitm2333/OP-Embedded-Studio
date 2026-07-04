import { mergeClassNames, serializeHTML } from './serialize'
import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from './types'

export interface HTMLBundleOptions {
  html?: 'fragment' | 'standalone'
  style?: 'inline' | 'tailwind'
  bundle?: 'inline' | 'external'
  fonts?: 'link' | 'none'
  assetBasePath?: string
}

export interface HTMLBundleFile {
  path: string
  content: string | Uint8Array
}

export interface HTMLBundle {
  entrypoint: string
  files: HTMLBundleFile[]
}

interface StandaloneBounds {
  minX: number
  minY: number
  width: number
  height: number
}

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong'
])

const RESET_CSS =
  '*,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#fff}'

function styleToCSS(style: DesignStyleDeclaration): string {
  return Object.entries(style)
    .filter(([, value]) => value !== '')
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
}

function cloneNode(node: DesignNode): DesignNode {
  if (node.type === 'text') return { ...node }
  return {
    ...node,
    attrs: { ...node.attrs },
    inlineStyle: node.inlineStyle ? { ...node.inlineStyle } : undefined,
    children: node.children.map(cloneNode)
  }
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
  if (node.type === 'text') return cloneNode(node)
  const standalone: DesignElement = {
    ...node,
    attrs: { ...node.attrs },
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

function standaloneDocument(document: DesignDocument, size: StandaloneBounds): DesignDocument {
  return {
    ...document,
    children: document.children.map((node) => standaloneNode(node, size))
  }
}

function normalizeFontFamily(value: string | undefined): string | undefined {
  const family = value
    ?.split(',')[0]
    ?.trim()
    .replace(/^['"]|['"]$/g, '')
  if (!family || GENERIC_FONT_FAMILIES.has(family.toLowerCase())) return undefined
  return family
}

function normalizeFontWeight(value: string | undefined): string {
  if (!value || value === 'normal') return '400'
  if (value === 'bold') return '700'
  return /^\d+$/.test(value) ? value : '400'
}

function collectFontFamilies(node: DesignNode, fonts: Map<string, Set<string>>): void {
  if (node.type === 'text') return
  const family = normalizeFontFamily(node.inlineStyle?.['font-family'])
  if (family) {
    const weights = fonts.get(family) ?? new Set<string>()
    weights.add(normalizeFontWeight(node.inlineStyle?.['font-weight']))
    fonts.set(family, weights)
  }
  for (const child of node.children) collectFontFamilies(child, fonts)
}

function googleFontsURL(fonts: Map<string, Set<string>>): string | undefined {
  if (fonts.size === 0) return undefined
  const families = [...fonts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([family, weights]) => {
      const encodedFamily = encodeURIComponent(family).replaceAll('%20', '+')
      const encodedWeights = [...weights]
        .sort((left, right) => Number(left) - Number(right))
        .join(';')
      return `family=${encodedFamily}:wght@${encodedWeights}`
    })
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

function fontLinks(document: DesignDocument, fonts: HTMLBundleOptions['fonts']): string {
  if (fonts === 'none') return ''
  const fontMap = new Map<string, Set<string>>()
  for (const child of document.children) collectFontFamilies(child, fontMap)
  const href = googleFontsURL(fontMap)
  if (!href) return ''
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${href}">`
}

function cssClassName(index: number): string {
  return `op-${index.toString(36)}`
}

function extractInlineStyles(
  node: DesignNode,
  rules: string[],
  nextIndex: { value: number }
): DesignNode {
  if (node.type === 'text') return node
  const children = node.children.map((child) => extractInlineStyles(child, rules, nextIndex))
  if (!node.inlineStyle || Object.keys(node.inlineStyle).length === 0) return { ...node, children }

  const className = cssClassName(nextIndex.value)
  nextIndex.value += 1
  rules.push(`.${className}{${styleToCSS(node.inlineStyle)}}`)
  return {
    ...node,
    attrs: { ...node.attrs, class: mergeClassNames(node.attrs.class, className) ?? className },
    inlineStyle: undefined,
    children
  }
}

function classNamesFromHTML(html: string): string[] {
  const classes = new Set<string>()
  for (const match of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const className of match[1]?.split(/\s+/) ?? []) {
      if (className) classes.add(className)
    }
  }
  return [...classes]
}

async function compileTailwindClasses(classNames: string[]): Promise<string> {
  if (classNames.length === 0) return ''
  const [{ compile }, { readFile }] = await Promise.all([
    import('tailwindcss'),
    import('node:fs/promises')
  ])
  const [themeCSS, utilitiesCSS] = await Promise.all([
    readFile(new URL(import.meta.resolve('tailwindcss/theme.css')), 'utf8'),
    readFile(new URL(import.meta.resolve('tailwindcss/utilities.css')), 'utf8')
  ])
  const compiler = await compile(`${themeCSS}\n${utilitiesCSS}`)
  return compiler.build(classNames)
}

function bytesFromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/svg+xml') return 'svg'
  return 'png'
}

function extractImages(
  html: string,
  assetBasePath: string
): { html: string; files: HTMLBundleFile[] } {
  const files: HTMLBundleFile[] = []
  const sources = new Map<string, string>()
  const nextHTML = html.replaceAll(
    /src="data:(image\/[a-zA-Z0-9.+-]+);base64,([^"]+)"/g,
    (source, mime: string, base64: string) => {
      const existing = sources.get(source)
      if (existing) return `src="${existing}"`
      const path = `${assetBasePath}/images/image-${sources.size + 1}.${extensionForMime(mime)}`
      sources.set(source, path)
      files.push({ path, content: bytesFromBase64(base64) })
      return `src="${path}"`
    }
  )
  return { html: nextHTML, files }
}

function stylesheetLink(path: string): string {
  return `<link rel="stylesheet" href="${path}">`
}

function styleTag(css: string): string {
  return css ? `<style>${css}</style>` : ''
}

async function bundleStandaloneHTML(
  document: DesignDocument,
  options: Required<HTMLBundleOptions>
): Promise<HTMLBundle> {
  const size = standaloneSize(document)
  const stageCSS = `.op-stage{position:relative;width:${size.width}px;height:${size.height}px;overflow:hidden;background:transparent}`
  const doc = standaloneDocument(document, size)
  const files: HTMLBundleFile[] = []
  let css = `${RESET_CSS}${stageCSS}`
  let body = ''

  if (options.style === 'tailwind') {
    body = serializeHTML(doc, { style: 'tailwind' })
    css += await compileTailwindClasses(classNamesFromHTML(body))
  } else {
    const rules: string[] = []
    const styledDoc: DesignDocument = {
      ...doc,
      children: doc.children.map((node) =>
        extractInlineStyles(node, rules, { value: rules.length })
      )
    }
    body = serializeHTML(styledDoc)
    css += rules.join('')
  }

  if (options.bundle === 'external') {
    const extracted = extractImages(body, options.assetBasePath)
    body = extracted.html
    files.push(...extracted.files)
    const cssPath = `${options.assetBasePath}/openpencil.css`
    files.push({ path: cssPath, content: css })
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${fontLinks(document, options.fonts)}${stylesheetLink(cssPath)}</head><body><main data-open-pencil-html="standalone" class="op-stage">${body}</main></body></html>`
    return { entrypoint: 'index.html', files: [{ path: 'index.html', content: html }, ...files] }
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${fontLinks(document, options.fonts)}${styleTag(css)}</head><body><main data-open-pencil-html="standalone" class="op-stage">${body}</main></body></html>`
  return { entrypoint: 'index.html', files: [{ path: 'index.html', content: html }] }
}

export async function bundleHTML(
  document: DesignDocument,
  options: HTMLBundleOptions = {}
): Promise<HTMLBundle> {
  const resolvedOptions: Required<HTMLBundleOptions> = {
    html: options.html ?? 'fragment',
    style: options.style ?? 'inline',
    bundle: options.bundle ?? 'inline',
    fonts: options.fonts ?? 'link',
    assetBasePath: options.assetBasePath ?? 'assets'
  }

  if (resolvedOptions.html === 'standalone') return bundleStandaloneHTML(document, resolvedOptions)

  return {
    entrypoint: 'index.html',
    files: [
      { path: 'index.html', content: serializeHTML(document, { style: resolvedOptions.style }) }
    ]
  }
}
