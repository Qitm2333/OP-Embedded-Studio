/* eslint-disable max-lines -- The serial chat workflow intentionally shares one browser session. */
import { expect, test, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

const USE_REAL_LLM = process.env.TEST_REAL_LLM === '1'
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? ''

let page: Page
let canvas: CanvasHelper

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await page.goto('/')
  canvas = new CanvasHelper(page)
  await canvas.waitForInit()

  if (!USE_REAL_LLM) {
    await injectMockTransport(page)
  }
})

test.afterAll(async () => {
  await page.close()
})

async function injectMockTransport(page: Page) {
  await page.evaluate(() => {
    const setChatTransport = window.openPencil?.setChatTransport
    if (!setChatTransport) throw new Error('Transport override not available')

    function renderSummary(protocolLeak: boolean, renderOnlyCompletion: boolean) {
      if (protocolLeak) return 'Changed the watch to a cool blue theme.'
      if (renderOnlyCompletion) return '已更新圆屏布局，并统一了内容对齐。'
      return 'Updated the current screen from complete JSX.'
    }

    let msgCounter = 0
    const requestAttempts = new Map<string, number>()

    setChatTransport(() => ({
      async sendMessages({
        messages
      }: {
        messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>
      }) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const text = lastUser?.parts?.find((p) => p.type === 'text')?.text ?? ''
        const msgId = `mock-msg-${++msgCounter}`
        const lowerText = text.toLowerCase()
        const attempt = (requestAttempts.get(lowerText) ?? 0) + 1
        requestAttempts.set(lowerText, attempt)
        const wantsImageTool = lowerText.includes('visual check')
        const wantsCodeDesign = lowerText.includes('code design')
        const wantsDirectCodeRender = lowerText.includes('direct code render')
        const wantsDirectCodeRenderError = lowerText.includes('direct code render error')
        const wantsRenderOnlyCompletion = lowerText.includes('render only completion')
        const wantsProtocolLeak = lowerText.includes('protocol leak')
        const wantsProtocolOnly = lowerText.includes('protocol only')
        const wantsDelayedFinish = lowerText.includes('delayed finish reply')
        const wantsProgress = lowerText.includes('progress note')
        const wantsLongStream = lowerText.includes('long stream')
        const wantsReasoningStream = lowerText.includes('reasoning stream')
        const wantsRenderTool =
          wantsDirectCodeRender || wantsProtocolLeak || wantsRenderOnlyCompletion
        const wantsTool =
          wantsImageTool ||
          wantsCodeDesign ||
          wantsDirectCodeRender ||
          wantsRenderOnlyCompletion ||
          wantsProtocolLeak ||
          wantsProgress ||
          lowerText.includes('frame') ||
          lowerText.includes('rectangle')
        const wantsToolText = wantsTool && !wantsRenderOnlyCompletion

        if (lowerText.includes('missing agent')) {
          throw new Error(
            '"claude-agent-acp" is not installed. Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
          )
        }
        if (lowerText.includes('retry connection') && attempt === 1) {
          throw new Error('Failed to fetch')
        }

        return new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'start', messageId: msgId })
            controller.enqueue({ type: 'start-step' })

            if (wantsReasoningStream) {
              controller.enqueue({ type: 'reasoning-start', id: 'reasoning-1' })
              for (const delta of [
                'Reading the current JSX.\n',
                ...Array.from(
                  { length: 14 },
                  (_, index) => `Checking layout constraint ${index + 1} of 14.\n`
                ),
                'Checking the round-screen safe area.\n',
                'Preparing the smallest coherent revision.'
              ]) {
                controller.enqueue({ type: 'reasoning-delta', id: 'reasoning-1', delta })
                await new Promise((resolve) => {
                  setTimeout(resolve, 80)
                })
              }
              controller.enqueue({ type: 'reasoning-end', id: 'reasoning-1' })
            }

            if (wantsTool) {
              type MockToolSpec = {
                name: string
                input: Record<string, unknown>
                output: Record<string, unknown>
              }
              let toolSpecs: MockToolSpec[]
              if (wantsRenderTool) {
                toolSpecs = [
                  {
                    name: 'render',
                    input: {
                      replace_id: '0:3',
                      summary: renderSummary(wantsProtocolLeak, wantsRenderOnlyCompletion),
                      jsx: '<Frame name="Private complete JSX" w={466} h={466} bg="#090B10" />'
                    },
                    output: wantsDirectCodeRenderError
                      ? { error: 'SVG path parsing failed before import: invalid path data' }
                      : { id: '0:24', name: 'Screen', type: 'FRAME', children: [] }
                  }
                ]
              } else if (wantsCodeDesign) {
                toolSpecs = [
                  {
                    name: 'render_design',
                    input: {
                      phase: 'revision',
                      observation: 'The accent needs stronger contrast against the dark dial.',
                      intent: 'Preserve the composition and correct only the palette.',
                      changes: ['Brighten the lightning mark', 'Keep the existing spacing'],
                      jsx: '<Frame name="Screen" w={466} h={466} bg="#090B10" />'
                    },
                    output: {
                      validation: { passed: true, issueCount: 0, warningCount: 0 },
                      mimeType: 'image/png',
                      base64:
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                      byteLength: 68
                    }
                  }
                ]
              } else if (wantsImageTool) {
                toolSpecs = [
                  {
                    name: 'export_image',
                    input: { format: 'PNG', scale: 1 },
                    output: {
                      mimeType: 'image/png',
                      base64:
                        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                      byteLength: 68
                    }
                  }
                ]
              } else if (wantsProgress) {
                const progress = {
                  phase: 'fix',
                  observation: 'The primary value is too close to the icon.',
                  nextAction: 'Increase the gap and align the value to the optical center.',
                  reason: 'This restores hierarchy and improves small-screen scanning.'
                }
                toolSpecs = [
                  {
                    name: 'report_progress',
                    input: progress,
                    output: { recorded: true, ...progress }
                  }
                ]
              } else {
                const shape = {
                  type: 'FRAME',
                  x: 100,
                  y: 100,
                  width: 200,
                  height: 150,
                  name: 'Card'
                }
                toolSpecs = [
                  { name: 'create_shape', input: shape, output: { id: '0:99', ...shape } },
                  {
                    name: 'set_layout',
                    input: { id: '0:99', direction: 'VERTICAL', spacing: 12 },
                    output: { id: '0:99', layoutMode: 'VERTICAL', itemSpacing: 12 }
                  },
                  {
                    name: 'update_node',
                    input: { id: '0:99', name: 'Charging Card' },
                    output: { id: '0:99', name: 'Charging Card' }
                  }
                ]
              }
              toolSpecs.forEach((toolSpec, index) => {
                const toolCallId = `call-${msgId}-${index}`
                controller.enqueue({
                  type: 'tool-input-start',
                  toolCallId,
                  toolName: toolSpec.name
                })
                controller.enqueue({
                  type: 'tool-input-delta',
                  toolCallId,
                  inputTextDelta: JSON.stringify(toolSpec.input)
                })
                controller.enqueue({
                  type: 'tool-input-available',
                  toolCallId,
                  toolName: toolSpec.name,
                  input: toolSpec.input
                })
                controller.enqueue({
                  type: 'tool-output-available',
                  toolCallId,
                  toolName: toolSpec.name,
                  output: toolSpec.output
                })
              })
              controller.enqueue({ type: 'finish-step' })
              controller.enqueue({ type: 'start-step' })
              if (wantsProgress) {
                await new Promise((resolve) => {
                  setTimeout(resolve, 200)
                })
              }
            }

            let words = `I'll help you with: "${text}". Here's a mock response.`.split(' ')
            if (wantsToolText) words = ['Created', 'a', 'frame', 'called', '"Card".']
            if (wantsRenderOnlyCompletion) words = []
            if (wantsProtocolLeak || wantsProtocolOnly) {
              words = ['<|DSML|tool_calls>\n<|DSML|invoke name="render">']
            }
            if (wantsLongStream) {
              words = [
                ...Array.from({ length: 80 }, (_, index) => `stream-${index + 1}`),
                'stream-finished'
              ]
            }

            controller.enqueue({ type: 'text-start', id: 'text-1' })
            for (const word of words) {
              controller.enqueue({ type: 'text-delta', id: 'text-1', delta: word + ' ' })
              if (wantsLongStream) {
                await new Promise((resolve) => {
                  setTimeout(resolve, 12)
                })
              }
            }
            if (wantsDelayedFinish) {
              await new Promise((resolve) => {
                setTimeout(resolve, 500)
              })
            }
            controller.enqueue({ type: 'text-end', id: 'text-1' })
            controller.enqueue({ type: 'finish-step' })
            controller.enqueue({ type: 'finish', finishReason: 'stop' })
            controller.close()
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  })
}

function chatTab() {
  return page.getByRole('tab', { name: 'AI' })
}

function designTab() {
  return page.getByRole('tab', { name: 'Design' })
}

function chatInput() {
  return page.locator('textarea[placeholder="Describe what you want to create or change."]')
}

function apiKeyInput() {
  return page.getByTestId('api-key-input')
}

test('⌘J switches to AI tab', async () => {
  await designTab().waitFor()
  await page.keyboard.press('ControlOrMeta+j')
  await expect(chatTab()).toHaveAttribute('data-state', 'active')
})

test('⌘J switches back to Design tab', async () => {
  await page.keyboard.press('ControlOrMeta+j')
  await expect(designTab()).toHaveAttribute('data-state', 'active')
})

test('clicking AI tab shows provider setup when no key set', async () => {
  await chatTab().click()
  await expect(apiKeyInput()).toBeVisible()
  await expect(page.getByText('Connect an AI provider to start chatting.')).toBeVisible()
  await expect(page.getByTestId('provider-custom-model')).toBeHidden()
})

test('saving API key shows chat interface', async () => {
  const key = USE_REAL_LLM ? OPENROUTER_KEY : 'sk-or-test-key-12345'
  await apiKeyInput().fill(key)
  await page.getByTestId('api-key-save').click()

  await expect(chatInput()).toBeVisible()
  await expect(page.getByText('Describe what you want to create or change.')).toBeVisible()
})

test('unified chat exposes deployment quick actions in the empty state', async () => {
  await chatTab().click()
  if (await apiKeyInput().isVisible()) {
    await apiKeyInput().fill('sk-or-device-quick-action-test')
    await page.getByTestId('api-key-save').click()
  }
  await expect(page.getByTestId('chat-mode-selector')).toBeHidden()
  await expect(page.getByText('Describe what you want to create or change.')).toBeVisible()
  await expect(page.getByTestId('device-quick-deploy-frame')).toBeVisible()
  await expect(page.getByTestId('device-quick-deploy-frame')).toContainText('烧录选中的画面')
  const quickActionsBox = await page.getByTestId('device-quick-actions').boundingBox()
  const inputBox = await page.getByTestId('chat-input').boundingBox()
  expect(quickActionsBox).not.toBeNull()
  expect(inputBox).not.toBeNull()
  expect((quickActionsBox?.y ?? 0) + (quickActionsBox?.height ?? 0)).toBeLessThanOrEqual(
    inputBox?.y ?? 0
  )
})

test('empty input has disabled send button', async () => {
  const sendButton = page.locator('button[type="submit"]')
  await expect(sendButton).toBeDisabled()
})

test('typing enables send button', async () => {
  await chatInput().fill('Make a red rectangle')
  const sendButton = page.locator('button[type="submit"]')
  await expect(sendButton).toBeEnabled()
})

test('Enter submits message and clears input', async () => {
  await chatInput().fill('Hello there')
  await chatInput().press('Enter')

  await expect(page.getByText('Hello there', { exact: true })).toBeVisible({ timeout: 5000 })
  await expect(chatInput()).toHaveValue('')
})

test('Shift+Enter inserts a newline without submitting', async () => {
  await chatInput().fill('First line')
  await chatInput().press('Shift+Enter')
  await chatInput().type('Second line')

  await expect(chatInput()).toHaveValue('First line\nSecond line')
  await expect(page.getByText('First line', { exact: true })).toBeHidden()
  await chatInput().fill('')
})

test('pasted reference image previews and sends with the user message', async () => {
  await chatInput().evaluate((element) => {
    const binary = atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    )
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const transfer = new DataTransfer()
    transfer.items.add(new File([bytes], 'reference.png', { type: 'image/png' }))
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true
      })
    )
  })

  await expect(page.getByTestId('chat-attachment-preview')).toBeVisible()
  await expect(page.getByTestId('chat-send-button')).toBeEnabled()
  await page.getByTestId('chat-send-button').click()
  await expect(page.getByTestId('chat-message-image').last()).toBeVisible()
})

test('assistant responds', async () => {
  if (USE_REAL_LLM) {
    await expect(page.locator('.chat-markdown, [class*="rounded-tl-md"]').first()).toBeVisible({
      timeout: 30000
    })
  } else {
    await expect(page.getByText('mock response', { exact: false }).last()).toBeVisible({
      timeout: 5000
    })
    await expect(page.getByTestId('chat-process-group')).toHaveCount(0)
  }
})

test('model selector is visible and clickable', async () => {
  const trigger = page.getByTestId('chat-model-selector')
  await expect(trigger).toBeVisible()
  await trigger.click()

  await expect(page.getByRole('option', { name: /Claude Sonnet 4\.6/ })).toBeVisible()
  await expect(page.getByText('Best for design')).toBeVisible()
  await expect(page.getByText('Free').first()).toBeVisible()

  await page.getByRole('option', { name: /Claude Sonnet 4\.6/ }).click()
  await expect(page.getByRole('option', { name: /Claude Sonnet 4\.6/ })).toBeHidden()
})

test('target screen can be selected from the chat input', async () => {
  const trigger = page.getByTestId('chat-screen-selector')
  await expect(trigger).toBeVisible()
  await expect(trigger).toContainText('Waveshare')
  await trigger.click()

  const squareScreen = page.getByRole('option', { name: /QS130TAB1005A.*240.*240/ })
  await expect(squareScreen).toBeVisible()
  await squareScreen.click()

  await expect(trigger).toContainText('QS130TAB1005A')
  await expect(trigger).toHaveAttribute('title', /240 × 240/)
})

test('tool calls render in assistant message', async () => {
  await chatInput().fill('Create a frame')
  await chatInput().press('Enter')

  if (USE_REAL_LLM) {
    await expect(page.locator('.chat-markdown, [class*="rounded-tl-md"]').first()).toBeVisible({
      timeout: 30000
    })
  } else {
    const processGroup = page.getByTestId('chat-process-group').last()
    const toolGroup = page.getByTestId('chat-tool-group').last()
    await expect(processGroup).toContainText('3 ops', { timeout: 5000 })
    await expect(page.getByText('Created a frame', { exact: false }).last()).toBeVisible()
    await expect(toolGroup).toBeHidden()
    await processGroup.getByRole('button').first().click()
    await expect(toolGroup).toBeVisible()
    await expect(toolGroup).toContainText('Done')
    await expect(page.getByText('Create Shape')).toBeHidden()
    await toolGroup.getByRole('button').click()
    await expect(page.getByText('Create Shape')).toBeVisible()
    await expect(page.getByText('Set Layout')).toBeVisible()
    await expect(page.getByText('Update Node')).toBeVisible()
  }
})

test('visual tool output renders an image without dumping base64', async () => {
  await chatInput().fill('Run a visual check')
  await chatInput().press('Enter')

  const processGroup = page.getByTestId('chat-process-group').last()
  await expect(processGroup).toBeVisible({ timeout: 5000 })
  await processGroup.getByRole('button').click()
  await expect(page.getByTestId('chat-tool-image')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Visual checkpoint')).toBeVisible()
  await expect(page.getByText('iVBORw0KGgoAAAANSUhEUg', { exact: false })).toBeHidden()
})

test('code-first design submissions show intent and pixels without exposing JSX', async () => {
  await chatInput().fill('Show a code design')
  await chatInput().press('Enter')

  const processGroup = page.getByTestId('chat-process-group').last()
  await expect(processGroup).toContainText('1 ops', { timeout: 5000 })
  await processGroup.getByRole('button').click()
  const design = page.getByTestId('chat-render-design').last()
  await expect(design).toBeVisible()
  await expect(design).toContainText('accent needs stronger contrast')
  await expect(design).toContainText('Brighten the lightning mark')
  await expect(design.getByTestId('chat-tool-image')).toBeVisible()
  await expect(page.getByText('<Frame name="Screen"', { exact: false })).toBeHidden()
})

test('direct code render stays compact and never exposes complete JSX', async () => {
  await chatInput().fill('Show a direct code render')
  await chatInput().press('Enter')

  const render = page.getByTestId('chat-code-render').last()
  await expect(render).toBeVisible({ timeout: 5000 })
  await expect(render).toContainText('Updated Screen')
  await expect(render).toContainText('Done')
  await expect(page.getByText('Created a frame', { exact: false }).last()).toBeVisible()
  await expect(page.getByText('Private complete JSX', { exact: false })).toBeHidden()
})

test('render-only completion stays sendable without rewriting chat history', async () => {
  await chatInput().fill('Show a render only completion')
  await chatInput().press('Enter')

  await expect(page.getByText('已更新圆屏布局，并统一了内容对齐。')).toBeVisible({
    timeout: 5000
  })
  await expect(page.getByTestId('chat-stop-button')).toBeHidden()

  await chatInput().fill('Continue after render completion')
  await chatInput().press('Enter')
  await expect(page.getByText('mock response', { exact: false }).last()).toBeVisible({
    timeout: 5000
  })
})

test('failed direct render returns to a sendable state', async () => {
  await chatInput().fill('Show a direct code render error')
  await chatInput().press('Enter')

  const render = page.getByTestId('chat-code-render').last()
  await expect(render).toContainText('Design code failed', { timeout: 5000 })
  await expect(render).toContainText('generated vector markup')
  await expect(page.getByTestId('chat-stop-button')).toBeHidden()

  await chatInput().fill('Hello after render failure')
  await expect(page.getByTestId('chat-send-button')).toBeEnabled()
  await chatInput().press('Enter')
  await expect(page.getByText('mock response', { exact: false }).last()).toBeVisible({
    timeout: 5000
  })
})

test('leaked DSML is hidden behind the successful render summary', async () => {
  await chatInput().fill('Show a protocol leak after render')
  await chatInput().press('Enter')

  await expect(page.getByText('Changed the watch to a cool blue theme.')).toBeVisible({
    timeout: 5000
  })
  await expect(page.getByText('DSML', { exact: false })).toBeHidden()

  const process = page.getByTestId('chat-process-group').last()
  await process.getByRole('button').click()
  await expect(page.getByTestId('chat-tool-protocol-warning')).toBeVisible()
  await expect(page.getByTestId('chat-tool-protocol-warning')).not.toContainText('DSML')
})

test('a protocol leak without a render shows an actionable warning', async () => {
  await chatInput().fill('Show protocol only')
  await chatInput().press('Enter')

  const warning = page.getByTestId('chat-tool-protocol-warning').last()
  await expect(warning).toBeVisible({ timeout: 5000 })
  await expect(warning).not.toContainText('DSML')
})

test('visible text hides the thinking indicator and allows drafting during stream cleanup', async () => {
  await chatInput().fill('Show a delayed finish reply')
  await chatInput().press('Enter')

  await expect(page.getByText('mock response', { exact: false }).last()).toBeVisible({
    timeout: 5000
  })
  await expect(page.getByTestId('chat-typing-indicator')).toBeHidden()
  await chatInput().fill('Next design adjustment')
  await expect(chatInput()).toHaveValue('Next design adjustment')
  await expect(page.getByTestId('chat-send-button')).toBeEnabled({ timeout: 5000 })
  await chatInput().fill('')
})

test('reasoning streams visibly and collapses behind the final summary', async () => {
  await chatInput().fill('Show a reasoning stream')
  await chatInput().press('Enter')

  const reasoning = page.getByTestId('chat-reasoning').last()
  await expect(reasoning).toContainText('Reading the current JSX', { timeout: 5000 })
  await expect(page.getByTestId('chat-typing-indicator')).toBeHidden()
  const reasoningContent = reasoning.getByTestId('chat-reasoning-content')
  await expect
    .poll(() => reasoningContent.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  await expect
    .poll(() => reasoningContent.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)
  await expect(page.getByText('mock response', { exact: false }).last()).toBeVisible({
    timeout: 5000
  })

  const process = page.getByTestId('chat-process-group').last()
  await expect(process).toBeVisible()
  await expect(reasoning).toBeHidden()
  await process.getByRole('button').first().click()
  await expect(reasoning).toContainText('Preparing the smallest coherent revision.')
})

test('progress tools render as visible work narration', async () => {
  await chatInput().fill('Show a progress note')
  await chatInput().press('Enter')

  const note = page.getByTestId('chat-progress-note')
  await expect(note).toBeVisible({ timeout: 5000 })
  await expect(note).toContainText('primary value is too close')
  await expect(note).toContainText('Increase the gap')
  await expect(note).toContainText('restores hierarchy')
  await expect(page.getByText('Report Progress')).toBeHidden()

  const processGroup = page.getByTestId('chat-process-group').last()
  await expect(processGroup).toBeVisible({ timeout: 5000 })
  await expect(note).toBeHidden()
  await expect(page.getByText('Created a frame', { exact: false }).last()).toBeVisible()
  await processGroup.getByRole('button').click()
  await expect(note).toBeVisible()

  await page.setViewportSize({ width: 820, height: 800 })
  await expect(note).toBeVisible()
  const hasOverflow = await note.evaluate((element) =>
    [element, ...element.querySelectorAll('*')].some(
      (child) => child.scrollWidth > child.clientWidth || child.scrollHeight > child.clientHeight
    )
  )
  expect(hasOverflow).toBe(false)
  await page.setViewportSize({ width: 1280, height: 800 })
})

test('manual scrolling is preserved while an assistant response streams', async () => {
  await chatInput().fill('Send a long stream')
  await chatInput().press('Enter')

  const viewport = page.getByTestId('chat-scroll-viewport')
  const response = page.getByTestId('chat-message-assistant').last()
  await expect(response).toContainText('stream-12', { timeout: 5000 })
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)

  await viewport.evaluate((element) => {
    element.scrollTop = 0
    element.dispatchEvent(new Event('scroll'))
  })
  await page.waitForTimeout(250)
  expect(await viewport.evaluate((element) => element.scrollTop)).toBeLessThan(48)

  await expect(response).toContainText('stream-finished', { timeout: 5000 })
  expect(await viewport.evaluate((element) => element.scrollTop)).toBeLessThan(48)
})

test('submitting a user message scrolls the conversation back to the bottom', async () => {
  const viewport = page.getByTestId('chat-scroll-viewport')
  await viewport.evaluate((element) => {
    element.scrollTop = 0
  })
  await chatInput().fill('Return to the latest message')
  await chatInput().press('Enter')
  await expect(page.getByText('Return to the latest message', { exact: true })).toBeVisible()

  await expect
    .poll(() =>
      viewport.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight
      )
    )
    .toBeLessThanOrEqual(2)
})

test('switching tabs preserves chat', async () => {
  const selectedModel = page.getByRole('option', { name: /Claude Sonnet 4\.6/ })
  if (await selectedModel.isVisible().catch(() => false)) {
    await selectedModel.click()
  }
  await designTab().click({ timeout: 10000 })
  await expect(designTab()).toHaveAttribute('data-state', 'active')

  await chatTab().click()
  await expect(page.getByText('Hello there', { exact: true })).toBeVisible({ timeout: 10000 })
})

test('OpenRouter accepts a custom model ID from provider settings', async () => {
  const customModel = 'meta-llama/llama-3.3-70b-instruct'

  await page.keyboard.press('Escape')
  await page.getByTestId('provider-settings-trigger').click()
  const customModelInput = page.getByTestId('provider-settings-custom-model')
  await expect(customModelInput).toBeVisible()
  await customModelInput.fill(customModel)
  await page.getByTestId('provider-settings-done').click()

  await expect(page.getByTestId('chat-custom-model-label')).toContainText(customModel)
  await expect(page.getByTestId('chat-model-selector')).toBeHidden()

  await page.getByTestId('provider-settings-trigger').click()
  await page.getByTestId('provider-settings-custom-model').fill('')
  await page.getByTestId('provider-settings-done').click()

  await expect(page.getByTestId('chat-model-selector')).toBeVisible()
})

test('transport errors remain visible with actionable details', async () => {
  await chatInput().fill('Trigger missing agent error')
  await chatInput().press('Enter')

  const error = page.getByTestId('chat-error')
  await expect(error).toBeVisible({ timeout: 5000 })
  await expect(error).toContainText('AI operation failed')
  await expect(error).toContainText(
    'Install it with: npm i -g @agentclientprotocol/claude-agent-acp'
  )
  await expect(page.getByTestId('chat-error-retry')).toBeVisible()
})

test('connection failures are classified and can retry the last response', async () => {
  await chatInput().fill('Retry connection once')
  await chatInput().press('Enter')

  const error = page.getByTestId('chat-error')
  await expect(error).toContainText('Model connection interrupted', { timeout: 5000 })
  await page.getByTestId('chat-error-retry').click()

  await expect(error).toBeHidden({ timeout: 5000 })
  await expect(page.getByText('mock response', { exact: false }).last()).toBeVisible()
})

test('"Get API key" link opens external URL via window.open', async () => {
  await page.evaluate("localStorage.removeItem('open-pencil:ai-key:openrouter')")
  await page.reload()
  await canvas.waitForInit()
  await chatTab().click()

  const link = page.getByTestId('api-key-get-link')
  await expect(link).toBeVisible()

  // Intercept window.open to verify it's called with the right URL
  const openedUrls: string[] = []
  await page.exposeFunction('mockWindowOpen', (url: string) => openedUrls.push(url))
  await page.evaluate(() => {
    window.openPencil ??= {}
    window.openPencil.test = { ...window.openPencil.test, savedOpen: window.open }
    window.open = (url: string | URL) => {
      window.mockWindowOpen?.(String(url))
      return null
    }
  })

  await link.click()

  await expect(() => {
    expect(openedUrls.length).toBeGreaterThan(0)
    expect(openedUrls[0]).toMatch(/^https:\/\//)
  }).toPass({ timeout: 3000 })

  // Restore
  await page.evaluate(() => {
    const savedOpen = window.openPencil?.test?.savedOpen
    if (savedOpen) window.open = savedOpen
  })
})
