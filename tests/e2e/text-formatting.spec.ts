import { test, expect, type Page } from '@playwright/test'

import { CanvasHelper } from '../helpers/canvas'
import { getSelectedNode, getEditingTextId } from '../helpers/store'

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await canvas.clearCanvas()

  await page.evaluate(() => {
    const store = window.__OPEN_PENCIL_STORE__!
    store.state.zoom = 1
    store.state.panX = 0
    store.state.panY = 0
    const id = store.createShape('TEXT', 200, 200, 150, 30)
    store.graph.updateNode(id, { text: 'Hello World', fontSize: 18 })
    store.select([id])
  })
  await canvas.waitForRender()
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
})

test.afterAll(async () => {
  await page.close()
})

test('double-click enters text edit mode', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  const editingId = await getEditingTextId(page)
  expect(editingId).not.toBeNull()
  canvas.assertNoErrors()
})

test('Cmd+B toggles bold', async () => {
  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Meta+b')
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  await canvas.click(275, 215)
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node!.fontWeight).toBe(700)
  canvas.assertNoErrors()
})

test('Cmd+I toggles italic', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  await page.keyboard.press('Meta+a')
  await page.keyboard.press('Meta+i')
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  await canvas.click(275, 215)
  await canvas.waitForRender()

  const node = await getSelectedNode(page)
  expect(node!.italic).toBe(true)
  canvas.assertNoErrors()
})

test('double-click word select changes canvas screenshot', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  const baseline = await canvas.screenshotCanvas()

  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  const selected = await canvas.screenshotCanvas()

  expect(Buffer.compare(baseline, selected)).not.toBe(0)
  await canvas.pressKey('Escape')
  await canvas.waitForRender()
  canvas.assertNoErrors()
})

test('Alt+ArrowRight word navigation stays in text edit mode', async () => {
  await canvas.dblclick(275, 215)
  await page.waitForTimeout(200)

  await page.keyboard.press('Alt+ArrowRight')
  await canvas.waitForRender()

  const editingId = await getEditingTextId(page)
  expect(editingId).not.toBeNull()
  canvas.assertNoErrors()
})

test('Bold button in panel toggles fontWeight', async () => {
  await canvas.pressKey('Escape')
  await canvas.waitForRender()

  await canvas.click(275, 215)
  await canvas.waitForRender()

  const before = await getSelectedNode(page)
  const initialWeight = before!.fontWeight

  await page.locator('[data-test-id="typography-bold-button"]').click()
  await canvas.waitForRender()

  const after = await getSelectedNode(page)
  expect(after!.fontWeight).not.toBe(initialWeight)
  canvas.assertNoErrors()
})
