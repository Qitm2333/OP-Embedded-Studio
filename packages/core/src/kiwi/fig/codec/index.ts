export {
  initCodec,
  getCompiledSchema,
  getSchemaBytes,
  isCodecReady,
  compress,
  decompress,
  encodeMessage,
  decodeMessage,
  peekMessageType,
  parseVariableId,
  createNodeChangesMessage,
  createNodeChange,
  encodePaintWithVariableBinding,
  encodeNodeChangeWithVariables
} from '@open-pencil/kiwi/fig/codec'

export type {
  GUID,
  Color,
  Matrix,
  Vector,
  ParentIndex,
  VariableBinding,
  Paint,
  Effect,
  VariableAnyValue,
  VariableDataEntry,
  VariableConsumptionEntry,
  VariableDataValuesEntry,
  PluginData,
  PluginRelaunchData,
  NodeChange,
  FigmaMessage
} from '@open-pencil/kiwi/fig/codec'
