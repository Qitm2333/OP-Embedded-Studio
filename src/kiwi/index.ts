/**
 * Figma Multiplayer Module
 *
 * Direct WebSocket access to Figma's multiplayer protocol.
 * Enables creating nodes 1000-5000x faster than the plugin API.
 */

export {
  FigmaMultiplayerClient,
  getCookiesFromDevTools,
  parseFileKey,
  type SessionInfo,
  type ConnectionOptions
} from './client.ts'

export {
  initCodec,
  encodeMessage,
  decodeMessage,
  createNodeChangesMessage,
  createNodeChange,
  parseVariableId,
  encodePaintWithVariableBinding,
  encodeNodeChangeWithVariables,
  type GUID,
  type Color,
  type Paint,
  type VariableBinding,
  type ParentIndex,
  type FigmaMessage
} from './codec.ts'

export {
  MESSAGE_TYPES,
  NODE_TYPES,
  NODE_PHASES,
  BLEND_MODES,
  PAINT_TYPES,
  PROTOCOL_VERSION,
  KIWI,
  SESSION_ID,
  ZSTD_MAGIC,
  buildMultiplayerUrl,
  isZstdCompressed,
  hasFigWireHeader,
  skipFigWireHeader,
  isKiwiMessage,
  getKiwiMessageType,
  parseVarint
} from './protocol.ts'
