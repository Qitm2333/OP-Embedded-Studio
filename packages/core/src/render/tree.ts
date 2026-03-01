export interface TreeNode {
  type: string
  props: Record<string, unknown>
  children: (TreeNode | string)[]
}

export function isTreeNode(x: unknown): x is TreeNode {
  if (x === null || typeof x !== 'object') return false
  const obj = x as Record<string, unknown>
  return typeof obj.type === 'string' && 'props' in obj && Array.isArray(obj.children)
}

interface ReactElement {
  type: unknown
  props: Record<string, unknown>
}

function isReactElement(x: unknown): x is ReactElement {
  return x !== null && typeof x === 'object' && 'type' in x && 'props' in x
}

function resolveElement(el: ReactElement, depth = 0): TreeNode | null {
  if (depth > 100) throw new Error('Component resolution depth exceeded')
  if (isTreeNode(el)) return el

  if (typeof el.type === 'function') {
    const result = (el.type as (p: Record<string, unknown>) => unknown)(el.props)
    if (isTreeNode(result)) return result
    if (isReactElement(result)) return resolveElement(result, depth + 1)
  }

  if (typeof el.type === 'string') {
    return convertToTree(el)
  }

  return null
}

function convertToTree(el: ReactElement): TreeNode {
  const children: (TreeNode | string)[] = []
  const elChildren = el.props.children

  if (elChildren != null) {
    const childArray = Array.isArray(elChildren) ? elChildren : [elChildren]
    for (const child of childArray.flat()) {
      if (child == null) continue
      if (typeof child === 'string' || typeof child === 'number') {
        children.push(String(child))
      } else if (isReactElement(child)) {
        const resolved = resolveElement(child)
        if (resolved) children.push(resolved)
      }
    }
  }

  const { children: _, ...props } = el.props
  return { type: el.type as string, props, children }
}

function processChild(child: unknown): TreeNode | string | null {
  if (child == null) return null
  if (typeof child === 'string' || typeof child === 'number') return String(child)
  if (isTreeNode(child)) return child
  if (isReactElement(child)) return resolveElement(child)
  return null
}

export function node(type: string, props: Record<string, unknown>): TreeNode {
  const { children, ...rest } = props
  const processed = [children]
    .flat(Infinity)
    .map(processChild)
    .filter((c): c is TreeNode | string => c !== null)
  return { type, props: rest, children: processed }
}

export type StyleProps = {
  flex?: 'row' | 'col' | 'column'
  gap?: number
  wrap?: boolean
  rowGap?: number
  justify?: 'start' | 'end' | 'center' | 'between'
  items?: 'start' | 'end' | 'center' | 'stretch'
  grow?: number

  w?: number | 'fill' | 'hug'
  h?: number | 'fill' | 'hug'
  minW?: number
  maxW?: number
  minH?: number
  maxH?: number

  x?: number
  y?: number

  p?: number
  px?: number
  py?: number
  pt?: number
  pr?: number
  pb?: number
  pl?: number

  bg?: string
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeAlign?: 'inside' | 'outside' | 'center'
  rounded?: number
  roundedTL?: number
  roundedTR?: number
  roundedBL?: number
  roundedBR?: number
  cornerSmoothing?: number
  opacity?: number
  blendMode?: string
  rotate?: number
  overflow?: 'hidden' | 'visible'
  shadow?: string
  blur?: number

  size?: number
  fontSize?: number
  font?: string
  fontFamily?: string
  weight?: number | 'bold' | 'medium' | 'normal'
  fontWeight?: number | 'bold' | 'medium' | 'normal'
  color?: string
  textAlign?: 'left' | 'center' | 'right' | 'justified'
  textAutoResize?: 'none' | 'width' | 'height'
}

export type BaseProps = StyleProps & {
  name?: string
  key?: string | number
  children?: unknown
}

export type TextProps = BaseProps
