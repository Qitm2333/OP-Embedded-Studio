import type { SceneNode } from '@open-pencil/scene-graph'

import {
  ALLOW_OVERLAP_PLUGIN_KEY,
  DESIGN_ROLE_PLUGIN_KEY,
  DESIGN_ROLES
} from '#core/design-semantics'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const updateNode = defineTool({
  name: 'update_node',
  mutates: true,
  description:
    'Update properties of an existing node: position, size, opacity, corner radius, visibility, text, font.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    x: { type: 'number', description: 'X position' },
    y: { type: 'number', description: 'Y position' },
    width: { type: 'number', description: 'Width', min: 1 },
    height: { type: 'number', description: 'Height', min: 1 },
    opacity: { type: 'number', description: 'Opacity (0-1)', min: 0, max: 1 },
    corner_radius: { type: 'number', description: 'Corner radius', min: 0 },
    visible: { type: 'boolean', description: 'Visibility' },
    text: { type: 'string', description: 'Text content (TEXT nodes)' },
    text_direction: {
      type: 'string',
      description: 'Text direction for TEXT nodes',
      enum: ['AUTO', 'LTR', 'RTL']
    },
    flow_direction: {
      type: 'string',
      description: 'Auto-layout flow direction for FRAME nodes',
      enum: ['AUTO', 'LTR', 'RTL']
    },
    font_size: { type: 'number', description: 'Font size', min: 1 },
    font_weight: { type: 'number', description: 'Font weight (100-900)' },
    name: { type: 'string', description: 'Layer name' },
    design_role: {
      type: 'string',
      description: 'Validation role for this layer',
      enum: [...DESIGN_ROLES]
    },
    allow_overlap: {
      type: 'boolean',
      description: 'Allow intentional overlap for a non-text decorative layer'
    }
  },
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    const updated: string[] = []
    if (args.x !== undefined) {
      node.x = args.x
      updated.push('x')
    }
    if (args.y !== undefined) {
      node.y = args.y
      updated.push('y')
    }
    if (args.width !== undefined || args.height !== undefined) {
      node.resize(args.width ?? node.width, args.height ?? node.height)
      updated.push('size')
    }
    if (args.opacity !== undefined) {
      node.opacity = args.opacity
      updated.push('opacity')
    }
    if (args.corner_radius !== undefined) {
      node.cornerRadius = args.corner_radius
      updated.push('cornerRadius')
    }
    if (args.visible !== undefined) {
      node.visible = args.visible
      updated.push('visible')
    }
    if (args.name !== undefined) {
      node.name = args.name
      updated.push('name')
    }
    if (args.text !== undefined) {
      figma.graph.updateNode(node.id, { text: args.text })
      updated.push('text')
    }
    if (args.text_direction !== undefined) {
      figma.graph.updateNode(node.id, {
        textDirection: args.text_direction as SceneNode['textDirection']
      })
      updated.push('textDirection')
    }
    if (args.flow_direction !== undefined) {
      figma.graph.updateNode(node.id, {
        layoutDirection: args.flow_direction as SceneNode['layoutDirection']
      })
      updated.push('layoutDirection')
    }
    if (args.font_size !== undefined) {
      figma.graph.updateNode(node.id, { fontSize: args.font_size })
      updated.push('fontSize')
    }
    if (args.font_weight !== undefined) {
      figma.graph.updateNode(node.id, { fontWeight: args.font_weight })
      updated.push('fontWeight')
    }
    if (args.design_role !== undefined) {
      node.setPluginData(DESIGN_ROLE_PLUGIN_KEY, args.design_role)
      updated.push('designRole')
    }
    if (args.allow_overlap !== undefined) {
      node.setPluginData(ALLOW_OVERLAP_PLUGIN_KEY, String(args.allow_overlap))
      updated.push('allowOverlap')
    }
    return { id: args.id, updated }
  }
})
