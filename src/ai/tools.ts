import { valibotSchema } from '@ai-sdk/valibot'
import { ALL_TOOLS, FigmaAPI, toolsToAI } from '@open-pencil/core'
import { tool } from 'ai'
import * as v from 'valibot'

import type { EditorStore } from '@/stores/editor'

export function createAITools(store: EditorStore) {
  return toolsToAI(
    ALL_TOOLS,
    {
      getFigma: () => {
        const api = new FigmaAPI(store.graph)
        api.currentPage = api.wrapNode(store.state.currentPageId)
        api.currentPage.selection = [...store.state.selectedIds]
          .map((id) => api.getNodeById(id))
          .filter((n): n is NonNullable<typeof n> => n !== null)
        return api
      },
      onAfterExecute: () => {
        store.requestRender()
      }
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
