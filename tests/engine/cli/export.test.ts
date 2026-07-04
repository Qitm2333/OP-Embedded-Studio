import { expect, setDefaultTimeout, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'

import { runOpenPencilCLI } from '#tests/helpers/cli'
import { createRect, firstPageId, makeSceneGraph } from '#tests/helpers/scene'

setDefaultTimeout(30_000)

const io = new IORegistry(BUILTIN_IO_FORMATS)

async function createFigFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'open-pencil-export-cli-'))
  const figPath = join(dir, 'card.fig')
  const graph = makeSceneGraph('Export Page')
  const rect = createRect(graph, firstPageId(graph), {
    name: 'Export Card',
    x: 0,
    y: 0,
    width: 160,
    height: 80
  })
  rect.layoutMode = 'HORIZONTAL'
  rect.itemSpacing = 8
  rect.paddingLeft = 16
  rect.paddingRight = 16
  rect.paddingTop = 16
  rect.paddingBottom = 16
  rect.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }]

  const result = await io.writeDocument('fig', graph)
  await Bun.write(figPath, result.data as Uint8Array)
  return { dir, figPath }
}

test('export CLI writes HTML with inline styles by default', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('data-open-pencil-node-id')
  expect(html).toContain('style=')
  expect(html).toContain('display: flex')
})

test('export CLI can write HTML styles as Tailwind classes', async () => {
  const { dir, figPath } = await createFigFixture()
  const output = join(dir, 'card-tailwind.html')

  const { stderr, exitCode } = await runOpenPencilCLI([
    'export',
    figPath,
    '--format',
    'html',
    '--style',
    'tailwind',
    '--output',
    output
  ])

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const html = await Bun.file(output).text()
  expect(html).toContain('data-open-pencil-node-id')
  expect(html).toContain('class="')
  expect(html).toContain('flex')
  expect(html).not.toContain('style=')
})
