import { compileTailwindCSS } from '@open-pencil/dom-css'

import { expect, test } from '../fixtures'

const STYLE_PROPERTIES = [
  'background-color',
  'border-radius',
  'color',
  'display',
  'gap',
  'padding-top',
  'width'
] as const

test.describe('@open-pencil/dom-css browser CSS runtime oracle', () => {
  test('resolves Tailwind variables and calc values in a real browser', async ({ page }) => {
    const classes = ['flex', 'gap-3', 'w-80', 'p-6', 'rounded-xl', 'bg-white', 'text-slate-900']
    const css = await compileTailwindCSS(classes)
    await page.setContent(`
      <style>${css}</style>
      <article class="${classes.join(' ')}">
        <h1>OpenPencil</h1>
      </article>
    `)

    const styles = await page.locator('article').evaluate((element, properties) => {
      const computed = getComputedStyle(element)
      return Object.fromEntries(
        properties.map((property) => [property, computed.getPropertyValue(property)])
      )
    }, STYLE_PROPERTIES)

    expect(styles.display).toBe('flex')
    expect(styles.gap).toBe('12px')
    expect(styles.width).toBe('320px')
    expect(styles['padding-top']).toBe('24px')
    expect(styles['border-radius']).toBe('12px')
    expect(styles['background-color']).toBe('rgb(255, 255, 255)')
    expect(styles.color).toMatch(/^(oklch|rgb)\(/)
  })

  test('resolves custom properties when assigned to real CSS properties', async ({ page }) => {
    await page.setContent(`
      <style>
        :root {
          --spacing: 0.25rem;
          --fallback-width: 10rem;
        }
        .card {
          --card-gap: calc(var(--spacing) * 3);
          --card-width: var(--missing-width, var(--fallback-width));
          display: flex;
          gap: var(--card-gap);
          width: calc(var(--card-width) + 16px);
          padding: calc(var(--spacing) * 6);
        }
      </style>
      <section class="card"><h1>Title</h1></section>
    `)

    const styles = await page.locator('.card').evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        customGap: computed.getPropertyValue('--card-gap'),
        gap: computed.getPropertyValue('gap'),
        paddingTop: computed.getPropertyValue('padding-top'),
        width: computed.getPropertyValue('width')
      }
    })

    expect(styles.customGap).toContain('calc')
    expect(styles.gap).toBe('12px')
    expect(styles.paddingTop).toBe('24px')
    expect(styles.width).toBe('176px')
  })
})
