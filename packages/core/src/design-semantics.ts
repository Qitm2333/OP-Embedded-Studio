import type { PluginDataEntry, SceneNode } from '@open-pencil/scene-graph'

export const DESIGN_ROLE_PLUGIN_KEY = 'ai-design-role'
export const ALLOW_OVERLAP_PLUGIN_KEY = 'ai-allow-overlap'
export const OPEN_PENCIL_PLUGIN_ID = 'open-pencil'

export const DESIGN_ROLES = [
  'content',
  'interaction',
  'decoration',
  'background',
  'overlay'
] as const

export type DesignRole = (typeof DESIGN_ROLES)[number]

export function isDesignRole(value: unknown): value is DesignRole {
  return typeof value === 'string' && DESIGN_ROLES.includes(value as DesignRole)
}

function pluginValue(node: Pick<SceneNode, 'pluginData'>, key: string): string | undefined {
  return node.pluginData.find(
    (entry) => entry.pluginId === OPEN_PENCIL_PLUGIN_ID && entry.key === key
  )?.value
}

export function explicitDesignRole(node: Pick<SceneNode, 'pluginData'>): DesignRole | undefined {
  const value = pluginValue(node, DESIGN_ROLE_PLUGIN_KEY)
  return isDesignRole(value) ? value : undefined
}

export function designRole(
  node: Pick<SceneNode, 'type' | 'name' | 'pluginData'>
): DesignRole | undefined {
  const explicit = explicitDesignRole(node)
  if (explicit) return explicit
  if (node.type === 'TEXT') return 'content'

  const name = node.name.toLowerCase()
  if (/(^|[\s_-])(background|backdrop|wallpaper|bg)([\s_-]|$)/.test(name)) return 'background'
  if (/(^|[\s_-])(glow|halo|ring|arc|bracket|ornament|decor)([\s_-]|$)/.test(name)) {
    return 'decoration'
  }
  return undefined
}

export function allowsDesignOverlap(
  node: Pick<SceneNode, 'type' | 'name' | 'pluginData'>
): boolean {
  const explicitPermission = pluginValue(node, ALLOW_OVERLAP_PLUGIN_KEY)
  if (explicitPermission !== undefined) return explicitPermission === 'true'
  const role = designRole(node)
  return role === 'decoration' || role === 'background' || role === 'overlay'
}

export function designMetadata(
  role: unknown,
  allowOverlap: unknown
): PluginDataEntry[] | undefined {
  const metadata: PluginDataEntry[] = []
  if (isDesignRole(role)) {
    metadata.push({ pluginId: OPEN_PENCIL_PLUGIN_ID, key: DESIGN_ROLE_PLUGIN_KEY, value: role })
  }
  if (typeof allowOverlap === 'boolean') {
    metadata.push({
      pluginId: OPEN_PENCIL_PLUGIN_ID,
      key: ALLOW_OVERLAP_PLUGIN_KEY,
      value: String(allowOverlap)
    })
  }
  return metadata.length > 0 ? metadata : undefined
}
