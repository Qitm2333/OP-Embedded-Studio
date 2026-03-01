import * as React from './mini-react'
import { isTreeNode, type TreeNode } from './tree'
import { renderTree, type RenderResult } from './renderer'

import type { SceneGraph } from '../scene-graph'

interface ReactElement {
  type: unknown
  props: Record<string, unknown>
}

function isReactElement(x: unknown): x is ReactElement {
  return x !== null && typeof x === 'object' && 'type' in x && 'props' in x
}

function resolveToTree(element: unknown, depth = 0): TreeNode | null {
  if (depth > 100) throw new Error('Component resolution depth exceeded')
  if (isTreeNode(element)) return element

  if (isReactElement(element)) {
    if (typeof element.type === 'function') {
      return resolveToTree(
        (element.type as (p: Record<string, unknown>) => unknown)(element.props),
        depth + 1
      )
    }
    if (typeof element.type === 'string') {
      const children: (TreeNode | string)[] = []
      const elChildren = element.props.children
      if (elChildren != null) {
        const childArray = Array.isArray(elChildren) ? elChildren : [elChildren]
        for (const child of childArray.flat()) {
          if (child == null) continue
          if (typeof child === 'string' || typeof child === 'number') {
            children.push(String(child))
          } else {
            const resolved = resolveToTree(child, depth + 1)
            if (resolved) children.push(resolved)
          }
        }
      }
      const { children: _, ...props } = element.props
      return { type: element.type, props, children }
    }
  }

  return null
}

/**
 * Build a component function from a JSX string using esbuild.
 * Uses mini-react createElement — no React dependency.
 * Only works in Node/Bun — not available in the browser.
 */
export async function buildComponent(jsxString: string): Promise<() => unknown> {
  let esbuild: typeof import('esbuild')
  try {
    esbuild = await import('esbuild')
  } catch {
    throw new Error('esbuild is required for JSX string rendering. Install it or use renderTreeNode() instead.')
  }

  const code = `
    const h = React.createElement
    const Frame = 'frame', Text = 'text', Rectangle = 'rectangle', Ellipse = 'ellipse'
    const Line = 'line', Star = 'star', Polygon = 'polygon', Vector = 'vector'
    const Group = 'group', Section = 'section', View = 'frame', Rect = 'rectangle'
    return function Component() { return ${jsxString.trim()} }
  `

  const result = esbuild.transformSync(code, {
    loader: 'tsx',
    jsx: 'transform',
    jsxFactory: 'h'
  })

  return new Function('React', result.code)(React) as () => unknown
}

interface RenderJsxOptions {
  x?: number
  y?: number
  parentId?: string
}

/**
 * Render a JSX string into the scene graph.
 * For headless/CLI use — requires esbuild.
 */
export async function renderJsx(
  graph: SceneGraph,
  jsxString: string,
  options?: RenderJsxOptions
): Promise<RenderResult> {
  const Component = await buildComponent(jsxString)
  const element = React.createElement(Component, null)
  const tree = resolveToTree(element)

  if (!tree) {
    throw new Error('JSX must return a Figma element (Frame, Text, etc)')
  }

  return renderTree(graph, tree, options)
}

/**
 * Render a pre-built TreeNode into the scene graph.
 * For in-browser use — no esbuild needed, tree is built by the AI SDK tool call.
 */
export function renderTreeNode(
  graph: SceneGraph,
  tree: TreeNode,
  options?: RenderJsxOptions
): RenderResult {
  return renderTree(graph, tree, options)
}
