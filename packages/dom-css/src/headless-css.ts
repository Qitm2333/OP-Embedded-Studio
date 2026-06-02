import { parse, type CSSStyleDeclarationLike, type CSSStyleRuleLike } from '@acemir/cssom'

import type { DesignDocument, DesignElement, DesignNode, DesignStyleDeclaration } from './types'

interface HeadlessCSSRule {
  selectors: string[]
  style: DesignStyleDeclaration
}

function styleToRecord(style: CSSStyleDeclarationLike): DesignStyleDeclaration {
  const result: DesignStyleDeclaration = {}
  for (const property of Array.from({ length: style.length }, (_, index) => style[index])) {
    const value = style.getPropertyValue(property)
    if (property && value) result[property] = value
  }
  return result
}

function isStyleRule(rule: unknown): rule is CSSStyleRuleLike {
  return (
    typeof rule === 'object' &&
    rule !== null &&
    'selectorText' in rule &&
    'style' in rule &&
    typeof rule.selectorText === 'string'
  )
}

function parseRules(cssText: string): HeadlessCSSRule[] {
  const sheet = parse(cssText)
  return sheet.cssRules.filter(isStyleRule).map((rule) => ({
    selectors: rule.selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter((selector) => selector.length > 0),
    style: styleToRecord(rule.style)
  }))
}

function classList(element: DesignElement): Set<string> {
  const className = 'class' in element.attrs ? element.attrs.class : ''
  return new Set(className.split(/\s+/).filter((name) => name.length > 0))
}

function matchesSimpleSelector(element: DesignElement, selector: string): boolean {
  if (selector.includes(' ') || selector.includes('>') || selector.includes(':')) return false
  if (selector.startsWith('.')) return classList(element).has(selector.slice(1))
  if (selector.startsWith('#')) return element.attrs.id === selector.slice(1)
  return element.tagName.toLowerCase() === selector.toLowerCase()
}

function matchesRule(element: DesignElement, rule: HeadlessCSSRule): boolean {
  return rule.selectors.some((selector) => matchesSimpleSelector(element, selector))
}

function applyComputedStyles(node: DesignNode, rules: HeadlessCSSRule[]): DesignNode {
  if (node.type === 'text') return node

  const computedStyle: DesignStyleDeclaration = {}
  for (const rule of rules) {
    if (matchesRule(node, rule)) Object.assign(computedStyle, rule.style)
  }
  Object.assign(computedStyle, node.inlineStyle)

  return {
    ...node,
    computedStyle: Object.keys(computedStyle).length > 0 ? computedStyle : undefined,
    children: node.children.map((child) => applyComputedStyles(child, rules))
  }
}

export function computeHeadlessStyles(document: DesignDocument, cssText = ''): DesignDocument {
  const stylesheetText = [document.stylesheets?.map((sheet) => sheet.cssText).join('\n'), cssText]
    .filter((text): text is string => !!text)
    .join('\n')
  const rules = parseRules(stylesheetText)

  return {
    ...document,
    children: document.children.map((child) => applyComputedStyles(child, rules))
  }
}
