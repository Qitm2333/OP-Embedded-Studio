import codegenPrompt from './prompts/codegen.md'

export { ALL_TOOLS, CORE_TOOLS, EXTENDED_TOOLS } from './registry'
export const CODEGEN_PROMPT: string = codegenPrompt
export { exportImage } from './vector'
export { defineTool, nodeToResult, nodeSummary, requireNode, NodeNotFoundError } from './schema'
export type { ToolDef, ParamDef, ParamType } from './schema'
export { toolsToAI, buildDebugLog } from './ai-adapter'
export type {
  ToolLogEntry,
  ToolDebugLog,
  AIAdapterOptions,
  StepBudget,
  ToolExecutionOutcome
} from './ai-adapter'
export { calcClusterConfidence, computeOverlaps, wrapEvalCode } from './analyze'
export {
  VALID_OVERLAP_CATEGORIES,
  VALID_OVERLAP_SCOPES,
  VALID_OVERLAP_SEVERITIES,
  parseOverlapCategories,
  parseOverlapScope,
  parseOverlapSeverity
} from './analyze/overlaps/params'
export { setPexelsApiKey, setUnsplashAccessKey } from './stock-photo'
export { importSvg } from './create'
export {
  DESIGN_ROLES,
  allowsDesignOverlap,
  designMetadata,
  designRole,
  explicitDesignRole,
  type DesignRole
} from '#core/design-semantics'
