import ExprEval from 'expr-eval'

import { defineTool } from './schema'

const parser = new ExprEval.Parser()

export const calc = defineTool({
  name: 'calc',
  description:
    'Arithmetic calculator. ALWAYS use this instead of mental math for layout calculations. ' +
    'Evaluates a math expression and returns the numeric result. ' +
    'Supports: + - * / % ** ( ) min max floor ceil round abs sqrt pow. ' +
    'Examples: "844 - 56 - 96 - 82" → 610, "floor(390 * 0.6)" → 234',
  params: {
    expr: {
      type: 'string',
      description: 'Math expression, e.g. "844 - 56 - 96 - 82" or "min(300, 400 - 2 * 20)"',
      required: true
    }
  },
  execute: (_figma, { expr }) => {
    try {
      const result = parser.evaluate(expr)
      if (!Number.isFinite(result)) {
        return { error: `Expression "${expr}" produced ${String(result)}` }
      }
      return { expr, result }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }
})
