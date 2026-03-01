import { defineCommand } from 'citty'

import colors from './colors'
import typography from './typography'
import spacing from './spacing'
import clusters from './clusters'

export default defineCommand({
  meta: { description: 'Analyze design tokens and patterns' },
  subCommands: {
    colors,
    typography,
    spacing,
    clusters
  }
})
