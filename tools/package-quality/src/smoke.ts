import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))
const packageDirs = [
  'packages/kiwi',
  'packages/core',
  'packages/dom-css',
  'packages/vue',
  'packages/mcp',
  'packages/cli'
]

function run(command: string[], cwd = rootDir): string {
  const proc = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const stdout = proc.stdout.toString()
  const stderr = proc.stderr.toString()
  if (!proc.success) {
    console.error(`$ ${command.join(' ')}`)
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    process.exit(proc.exitCode || 1)
  }
  return stdout.trim()
}

function nodeEval(code: string, cwd: string): void {
  run(['node', '--input-type=module', '--eval', code], cwd)
}

const tempDir = mkdtempSync(join(tmpdir(), 'open-pencil-package-smoke-'))

try {
  run(['bun', 'run', 'build:packages'])

  const tarballs: string[] = []
  for (const packageDir of packageDirs) {
    const output = run(
      ['bun', 'pm', 'pack', '--destination', tempDir, '--quiet'],
      join(rootDir, packageDir)
    )
    const filename = output
      .split('\n')
      .map((line) => line.trim())
      .findLast((line) => line.length > 0)
    if (!filename) throw new Error(`No tarball produced for ${packageDir}`)
    const tarball = filename.startsWith('/') ? filename : join(tempDir, filename)
    tarballs.push(tarball)

    const contents = run(['tar', '-tf', tarball])
    const runtimeTs = contents
      .split('\n')
      .filter((entry) => /package\/src\/.*\.ts$/.test(entry) && !entry.endsWith('.d.ts'))
    if (runtimeTs.length > 0) {
      console.error(`${basename(tarball)} includes runtime TypeScript:\n${runtimeTs.join('\n')}`)
      process.exit(1)
    }
  }

  run(['npm', 'init', '-y'], tempDir)
  run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], tempDir)

  nodeEval("await import('@open-pencil/kiwi')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/schema-runtime')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/codec')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/container')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/guid')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/parse')", tempDir)
  nodeEval("await import('@open-pencil/core')", tempDir)
  nodeEval("await import('@open-pencil/core/scene-graph')", tempDir)
  nodeEval("await import('@open-pencil/dom-css')", tempDir)
  nodeEval("await import('@open-pencil/dom-css/browser')", tempDir)
  nodeEval("await import('@open-pencil/dom-css/jsx-runtime')", tempDir)
  nodeEval("await import('@open-pencil/dom-css/jsx-dev-runtime')", tempDir)
  nodeEval("await import('@open-pencil/vue')", tempDir)
  nodeEval("await import('@open-pencil/mcp')", tempDir)

  nodeEval(
    "const { guidToString } = await import('@open-pencil/kiwi/fig/guid'); if (guidToString({ sessionID: 1, localID: 2 }) !== '1:2') throw new Error('Kiwi GUID subpath failed')",
    tempDir
  )
  nodeEval(
    "const { htmlToSceneGraph } = await import('@open-pencil/dom-css'); const graph = await htmlToSceneGraph('<div class=card>OpenPencil</div>', { cssText: '.card { width: 320px; }' }); if (graph.getPages()[0].width !== 320) throw new Error('DOM/CSS scene graph smoke failed')",
    tempDir
  )

  run(['node', 'node_modules/.bin/openpencil', '--help'], tempDir)
  run(['node', 'node_modules/.bin/openpencil-mcp', '--help'], tempDir)
  run(['node', 'node_modules/.bin/openpencil-mcp-http', '--help'], tempDir)

  console.log('Packed package smoke tests passed.')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
