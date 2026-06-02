import type { DesignStyleDeclaration } from './types'

export function parseStyleAttribute(value: string | undefined): DesignStyleDeclaration | undefined {
  if (!value) return undefined

  const style: DesignStyleDeclaration = {}
  for (const declaration of value.split(';')) {
    const separatorIndex = declaration.indexOf(':')
    if (separatorIndex <= 0) continue

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
    const propertyValue = declaration.slice(separatorIndex + 1).trim()
    if (property.length > 0 && propertyValue.length > 0) style[property] = propertyValue
  }

  return Object.keys(style).length > 0 ? style : undefined
}
