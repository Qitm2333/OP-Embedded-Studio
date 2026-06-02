import { serializeHTML } from '../serialize'
import type {
  CssComputeOptions,
  CssRuntime,
  DesignDocument,
  DesignElement,
  DesignNode
} from '../types'

const DEFAULT_COMPUTED_PROPERTIES = [
  'align-items',
  'background-color',
  'background-image',
  'border-bottom-color',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'border-bottom-width',
  'border-left-color',
  'border-left-width',
  'border-radius',
  'border-right-color',
  'border-right-width',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-top-width',
  'box-shadow',
  'color',
  'display',
  'flex-direction',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'gap',
  'height',
  'justify-content',
  'letter-spacing',
  'line-height',
  'opacity',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration-line',
  'width'
] as const

function requireBrowserDocument(): Document {
  if (typeof document === 'undefined') {
    throw new TypeError('Browser CSS runtime requires a DOM document')
  }
  return document
}

function attributesToRecord(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const attr of Array.from(element.attributes)) {
    attrs[attr.name] = attr.value
  }
  return attrs
}

function styleToRecord(style: CSSStyleDeclaration): Record<string, string> | undefined {
  const entries: Record<string, string> = {}
  for (const property of Array.from(style)) {
    const value = style.getPropertyValue(property)
    if (value) entries[property] = value
  }
  return Object.keys(entries).length > 0 ? entries : undefined
}

function domNodeToDesignNode(node: Node): DesignNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text.length > 0 ? { type: 'text', text } : null
  }

  if (node.nodeType !== Node.ELEMENT_NODE || !(node instanceof Element)) return null

  const children = Array.from(node.childNodes)
    .map(domNodeToDesignNode)
    .filter((child): child is DesignNode => child !== null)

  return {
    type: 'element',
    tagName: node.tagName.toLowerCase(),
    attrs: attributesToRecord(node),
    children,
    inlineStyle: node instanceof HTMLElement ? styleToRecord(node.style) : undefined
  }
}

function parseHTML(html: string): DesignDocument {
  requireBrowserDocument()
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  return {
    type: 'document',
    children: Array.from(parsed.body.childNodes)
      .map(domNodeToDesignNode)
      .filter((node): node is DesignNode => node !== null)
  }
}

function collectElementPairs(
  designNode: DesignNode,
  domNode: Node,
  pairs: [DesignElement, Element][]
): void {
  if (designNode.type === 'text') return
  if (!(domNode instanceof Element)) return

  pairs.push([designNode, domNode])

  const elementChildren = designNode.children.filter(
    (child): child is DesignElement => child.type === 'element'
  )
  const domChildren = Array.from(domNode.children)
  for (const [index, child] of elementChildren.entries()) {
    const domChild = domChildren.at(index)
    if (domChild) collectElementPairs(child, domChild, pairs)
  }
}

function computedStyleToRecord(
  style: CSSStyleDeclaration,
  options: CssComputeOptions
): Record<string, string> {
  const entries: Record<string, string> = {}
  const properties = options.includeBrowserDefaults
    ? Array.from(style)
    : DEFAULT_COMPUTED_PROPERTIES

  for (const property of properties) {
    const value = style.getPropertyValue(property)
    if (value) entries[property] = value
  }

  return entries
}

async function computeStyles(
  designDocument: DesignDocument,
  cssText = '',
  options: CssComputeOptions = {}
): Promise<DesignDocument> {
  const browserDocument = requireBrowserDocument()
  const host = browserDocument.createElement('div')
  host.style.cssText = [
    'position: fixed',
    'left: -100000px',
    'top: 0',
    'width: 1000px',
    'height: auto',
    'visibility: hidden',
    'pointer-events: none',
    'contain: layout style paint'
  ].join(';')

  const shadow = host.attachShadow({ mode: 'open' })
  const style = browserDocument.createElement('style')
  style.textContent = cssText
  shadow.append(style)

  const content = browserDocument.createElement('div')
  content.innerHTML = serializeHTML(designDocument)
  shadow.append(content)
  browserDocument.body.append(host)

  try {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })

    const nextDocument = structuredClone(designDocument)
    const pairs: [DesignElement, Element][] = []
    const domChildren = Array.from(content.childNodes)
    for (const [index, child] of nextDocument.children.entries()) {
      const domChild = domChildren.at(index)
      if (domChild) collectElementPairs(child, domChild, pairs)
    }

    for (const [designElement, domElement] of pairs) {
      designElement.computedStyle = computedStyleToRecord(getComputedStyle(domElement), options)
    }

    return nextDocument
  } finally {
    host.remove()
  }
}

export function createBrowserCssRuntime(): CssRuntime {
  return {
    kind: 'browser',
    parseHTML,
    serializeHTML,
    computeStyles
  }
}
