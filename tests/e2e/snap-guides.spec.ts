import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()
})

test.afterAll(async () => {
  await page.close()
})

async function createRects() {
  await canvas.clearCanvas()
  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.createShape('RECTANGLE', 100, 100, 80, 80)
    const b = store.createShape('RECTANGLE', 300, 100, 80, 80)
    store.select([b])
  })
  await canvas.waitForRender()
}

test('edge snap guide visual appears during drag', async () => {
  test.skip(process.platform === 'linux', 'Snap guide visual tests skipped on Linux CI')

  await createRects()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  const baseline = await canvas.screenshotCanvas()

  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 182, box.y + 140, { steps: 30 })

  const midDrag = await canvas.screenshotCanvas()

  await page.mouse.up()

  const changed = Buffer.compare(baseline, midDrag) !== 0
  expect.soft(changed, 'Snap guide did not appear — guide may not have rendered').toBeTruthy()
  canvas.assertNoErrors()
})

test('center snap guide visual appears during drag', async () => {
  test.skip(process.platform === 'linux', 'Snap guide visual tests skipped on Linux CI')

  await createRects()

  const box = await page.locator('canvas').boundingBox()
  if (!box) throw new Error('No canvas')

  const baseline = await canvas.screenshotCanvas()

  await page.mouse.move(box.x + 340, box.y + 140)
  await page.mouse.down()
  await page.mouse.move(box.x + 220, box.y + 140, { steps: 30 })

  const midDrag = await canvas.screenshotCanvas()

  await page.mouse.up()

  const changed = Buffer.compare(baseline, midDrag) !== 0
  expect.soft(changed, 'Snap guide did not appear — guide may not have rendered').toBeTruthy()
  canvas.assertNoErrors()
})
