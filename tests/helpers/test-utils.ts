import { describe } from 'bun:test'

export const heavy = describe.if(!!process.env.BUN_HEAVY_TESTS)
