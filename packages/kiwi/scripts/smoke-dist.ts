import { getSchemaBytes, initCodec, isCodecReady } from '../dist/fig/codec.js'
import { figmaSchema, getKiwiMessageType, parseSchema, validateSchema } from '../dist/index.js'

const schema = parseSchema(`
message Smoke {
  uint id = 1;
}
`)
validateSchema(schema)
validateSchema(figmaSchema)

if (figmaSchema.definitions.length !== 605) {
  throw new Error(`Unexpected Figma schema definition count: ${figmaSchema.definitions.length}`)
}

if (getKiwiMessageType(new Uint8Array([1, 3, 0])) !== 3) {
  throw new Error('Failed to read Kiwi message type from built dist')
}

await initCodec()

if (!isCodecReady() || getSchemaBytes().length === 0) {
  throw new Error('Failed to initialize built FIG codec')
}
