import { test, expect } from '@playwright/test'
import { CanvasHelper } from '../helpers/canvas'

const NODE_COUNT = 500
const ITERATIONS = 200

test.describe('Render performance', () => {
  let helper: CanvasHelper

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    helper = new CanvasHelper(page)
    await page.goto('http://localhost:1420/?test&no-chrome')
    await helper.waitForInit()

    await page.evaluate((count: number) => {
      const store = window.__OPEN_PENCIL_STORE__!
      const arr = new Uint8Array(count * 3)
      crypto.getRandomValues(arr)
      const cols = Math.ceil(Math.sqrt(count))
      for (let i = 0; i < count; i++) {
        const mod = i % 10
        const isVector = mod === 0
        const isEllipse = mod === 5
        const type = isVector ? ('VECTOR' as const) : isEllipse ? ('ELLIPSE' as const) : ('RECTANGLE' as const)
        const props: Record<string, unknown> = {
          x: (i % cols) * 60,
          y: Math.floor(i / cols) * 60,
          width: 50,
          height: 50,
          cornerRadius: type === 'RECTANGLE' ? 8 : 0,
          fills: [
            {
              type: 'SOLID',
              color: {
                r: arr[i * 3]! / 255,
                g: arr[i * 3 + 1]! / 255,
                b: arr[i * 3 + 2]! / 255,
                a: 1
              },
              visible: true,
              opacity: 1
            }
          ],
          strokes: [
            { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, visible: true, opacity: 1, weight: 1 }
          ]
        }
        if (isVector) {
          props.vectorNetwork = {
            vertices: [
              { x: 0, y: 25 },
              { x: 25, y: 0 },
              { x: 50, y: 25 },
              { x: 25, y: 50 }
            ],
            segments: [
              { start: 0, end: 1, tangentStart: { x: 0, y: -15 }, tangentEnd: { x: -15, y: 0 } },
              { start: 1, end: 2, tangentStart: { x: 15, y: 0 }, tangentEnd: { x: 0, y: -15 } },
              { start: 2, end: 3, tangentStart: { x: 0, y: 15 }, tangentEnd: { x: 15, y: 0 } },
              { start: 3, end: 0, tangentStart: { x: -15, y: 0 }, tangentEnd: { x: 0, y: 15 } }
            ],
            regions: [{ loops: [[0, 1, 2, 3]], windingRule: 'NONZERO' as const }]
          }
        }
        store.graph.createNode(type, store.state.currentPageId, props)
      }
      store.requestRender()
    }, NODE_COUNT)

    await helper.waitForRender()
  })

  test.afterAll(async () => {
    await helper.page.close()
  })

  test('benchmark: synchronous render throughput', async () => {
    const results = await helper.page.evaluate((iterations: number) => {
      const store = window.__OPEN_PENCIL_STORE__!
      const renderer = (store as Record<string, unknown>).renderer as {
        render: Function
        panX: number
        panY: number
        zoom: number
        dpr: number
        viewportWidth: number
        viewportHeight: number
        showRulers: boolean
        pageColor: { r: number; g: number; b: number }
        pageId: string | null
      }

      function setupRenderer() {
        renderer.dpr = window.devicePixelRatio || 1
        renderer.panX = store.state.panX
        renderer.panY = store.state.panY
        renderer.zoom = store.state.zoom
        renderer.viewportWidth = 1280
        renderer.viewportHeight = 800
        renderer.showRulers = false
        renderer.pageColor = store.state.pageColor
        renderer.pageId = store.state.currentPageId
      }

      // Warm up
      setupRenderer()
      renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)
      renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)

      // Benchmark 1: Pan (repaint — picture cache hit)
      setupRenderer()
      const panStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        renderer.panX += 2
        renderer.panY += 1
        renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)
      }
      const panMs = performance.now() - panStart

      // Benchmark 2: Scene change (cache miss every frame)
      const nodes = [...store.graph.getNode(store.state.currentPageId)!.childIds]
      setupRenderer()
      const sceneStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        const node = store.graph.getNode(nodes[i % nodes.length]!)
        if (node) store.graph.updateNode(node.id, { x: node.x + 0.1 })
        store.state.sceneVersion++
        renderer.render(store.graph, store.state.selectedIds, {}, store.state.sceneVersion)
      }
      const sceneMs = performance.now() - sceneStart

      // Benchmark 3: Hover (volatile overlay, no caching)
      setupRenderer()
      const hoverStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        renderer.render(
          store.graph,
          store.state.selectedIds,
          { hoveredNodeId: nodes[i % nodes.length] },
          store.state.sceneVersion
        )
      }
      const hoverMs = performance.now() - hoverStart

      return {
        pan: { ms: Math.round(panMs * 100) / 100, avg: Math.round((panMs / iterations) * 100) / 100 },
        scene: { ms: Math.round(sceneMs * 100) / 100, avg: Math.round((sceneMs / iterations) * 100) / 100 },
        hover: { ms: Math.round(hoverMs * 100) / 100, avg: Math.round((hoverMs / iterations) * 100) / 100 }
      }
    }, ITERATIONS)

    console.log(`\n═══ RENDER BENCHMARK (${NODE_COUNT} nodes, ${ITERATIONS} iterations) ═══`)
    console.log(`  Pan (cache hit):    ${results.pan.avg}ms/frame  (${results.pan.ms}ms total)`)
    console.log(`  Scene change:       ${results.scene.avg}ms/frame  (${results.scene.ms}ms total)`)
    console.log(`  Hover (no cache):   ${results.hover.avg}ms/frame  (${results.hover.ms}ms total)`)
    console.log(`  Speedup (pan vs scene): ${(results.scene.avg / results.pan.avg).toFixed(1)}x`)
    console.log(`═══════════════════════════════════════════════════════\n`)

    expect(results.pan.avg).toBeLessThan(50)
  })
})
