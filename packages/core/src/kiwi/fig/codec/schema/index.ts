import { parseSchema, validateSchema } from '#core/kiwi/schema-runtime'

import schemaText from './fig.kiwi?raw'

const schema = parseSchema(schemaText)
validateSchema(schema)

export default schema
