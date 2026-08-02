import { valibotSchema } from '@ai-sdk/valibot'
import { tool } from 'ai'
import * as v from 'valibot'

import { computeAllLayouts } from '@open-pencil/core/layout'
import { CORE_TOOLS, toolsToAI } from '@open-pencil/core/tools'
import type { StepBudget, ToolLogEntry } from '@open-pencil/core/tools'
import type { SceneNode } from '@open-pencil/scene-graph'

import { makeFigmaFromStore } from '@/app/automation/bridge/figma-factory'
import { getActiveEditorStore } from '@/app/editor/active-store'
import type { EditorStore } from '@/app/editor/active-store'
import { ensureGraphFonts } from '@/app/editor/fonts'

export const MAX_AGENT_STEPS = 50

export interface StepUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  timestamp: number
}

class RunState {
  toolLog: ToolLogEntry[] = []
  stepUsages: StepUsage[] = []
  currentSteps = 0

  recordStep(usage: StepUsage): void {
    this.stepUsages.push(usage)
    this.currentSteps++
  }

  resetSteps(): void {
    this.currentSteps = 0
  }

  hitLimit(): boolean {
    return this.currentSteps >= MAX_AGENT_STEPS
  }

  clear(): void {
    this.toolLog = []
    this.stepUsages = []
    this.currentSteps = 0
  }
}

const runStates = new WeakMap<EditorStore, RunState>()

function getRunState(store?: EditorStore): RunState {
  const target = store ?? getActiveEditorStore()
  const existing = runStates.get(target)
  if (existing) return existing
  const created = new RunState()
  runStates.set(target, created)
  return created
}

function hasResultError(result: unknown): boolean {
  return !!result && typeof result === 'object' && 'error' in result
}

export function getToolLogEntries(store?: EditorStore): ToolLogEntry[] {
  return getRunState(store).toolLog
}

export function getStepUsages(store?: EditorStore): StepUsage[] {
  return getRunState(store).stepUsages
}

export function recordStepUsage(usage: StepUsage, store?: EditorStore): void {
  getRunState(store).recordStep(usage)
}

export function resetRunSteps(store?: EditorStore): void {
  getRunState(store).resetSteps()
}

export function didHitStepLimit(store?: EditorStore): boolean {
  return getRunState(store).hitLimit()
}

export function clearToolLogEntries(store?: EditorStore): void {
  getRunState(store).clear()
}

export function createAITools(
  store: EditorStore,
  options: { onRenderSuccess?: (result: { id: string; name: string }) => void } = {}
) {
  const runState = getRunState(store)

  return toolsToAI(
    CORE_TOOLS,
    {
      getFigma: () => makeFigmaFromStore(store),
      onBeforeExecute: (def) => (def.mutates ? store.snapshotPage() : undefined),
      onAfterExecute: async (def, outcome, executionContext) => {
        if (!def.mutates) return

        const before = executionContext as Map<string, SceneNode> | undefined
        if (outcome.error || hasResultError(outcome.result)) {
          if (before) store.restorePageFromSnapshot(before)
          store.requestRender()
          return
        }

        const pageId = store.state.currentPageId
        const pageNode = store.graph.getNode(pageId)
        try {
          if (pageNode) await ensureGraphFonts(store.graph, pageNode.childIds)
          computeAllLayouts(store.graph, pageId)
          store.requestRender()
        } catch (error) {
          if (before) store.restorePageFromSnapshot(before)
          store.requestRender()
          throw error
        }

        if (before) {
          const after = store.snapshotPage()
          store.pushUndoEntry({
            label: `AI: ${def.name}`,
            forward: () => store.restorePageFromSnapshot(after),
            inverse: () => store.restorePageFromSnapshot(before)
          })
        }

        if (def.name !== 'render') return
        const id =
          outcome.result &&
          typeof outcome.result === 'object' &&
          'id' in outcome.result &&
          typeof outcome.result.id === 'string'
            ? outcome.result.id
            : undefined
        const frame = id ? store.graph.getNode(id) : undefined
        if (frame?.type !== 'FRAME') return
        store.select([frame.id])
        options.onRenderSuccess?.({ id: frame.id, name: frame.name })
      },
      onFlashNodes: (nodeIds) => {
        store.renderer?.aiClearActive()
        if (nodeIds.length > 0) store.aiFlashDone(nodeIds)
      },
      onToolLog: (entry) => {
        runState.toolLog.push(entry)
      },
      getStepBudget: (): StepBudget => ({
        current: runState.currentSteps,
        max: MAX_AGENT_STEPS
      })
    },
    { v, valibotSchema, tool }
  )
}

export type AITools = ReturnType<typeof createAITools>
