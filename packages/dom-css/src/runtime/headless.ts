import { serializeHTML } from '../serialize'
import type { CssRuntime, DesignDocument } from '../types'

function unavailable(feature: string): never {
  throw new Error(
    `${feature} requires a headless DOM/CSS adapter. Planned dependencies: parse5 + CSSOM.`
  )
}

export function createHeadlessCssRuntime(): CssRuntime {
  return {
    kind: 'headless',
    parseHTML() {
      return unavailable('parseHTML')
    },
    serializeHTML(document: DesignDocument) {
      return serializeHTML(document)
    },
    computeStyles() {
      return unavailable('computeStyles')
    }
  }
}
