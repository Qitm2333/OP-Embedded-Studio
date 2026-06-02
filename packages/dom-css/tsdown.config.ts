import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts'
  },
  platform: 'neutral',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  hash: false,
  clean: true,
  outDir: './dist',
  treeshake: {
    moduleSideEffects: false
  },
  deps: {
    neverBundle: ['@open-pencil/core', /^@open-pencil\/core\//],
    onlyBundle: false
  }
})
