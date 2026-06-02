import type { Page } from '@playwright/test'

import { compileTailwindCSS } from '@open-pencil/dom-css'

import { tailwindButtonClasses, tailwindCardClasses } from '#tests/helpers/dom-css'

import { expect, test } from '../fixtures'

async function setStyledContent(page: Page, css: string, body: string) {
  await page.setContent(`
    <style>${css}</style>
    ${body}
  `)
}

async function computedStyleProperties(
  page: Page,
  selector: string,
  properties: readonly string[]
) {
  return page.locator(selector).evaluate((element, styleProperties) => {
    const computed = getComputedStyle(element)
    return Object.fromEntries(
      styleProperties.map((property) => [property, computed.getPropertyValue(property)])
    )
  }, properties)
}

test.describe('@open-pencil/dom-css browser CSS runtime oracle', () => {
  test('resolves Tailwind card variables and calc values in a real browser', async ({ page }) => {
    const css = await compileTailwindCSS(tailwindCardClasses)
    await setStyledContent(
      page,
      css,
      `<article class="${tailwindCardClasses.join(' ')}"><h1>OpenPencil</h1></article>`
    )

    const styles = await computedStyleProperties(page, 'article', [
      'background-color',
      'border-radius',
      'color',
      'display',
      'flex-direction',
      'gap',
      'height',
      'padding-top',
      'width'
    ])

    expect(styles.display).toBe('flex')
    expect(styles['flex-direction']).toBe('column')
    expect(styles.gap).toBe('12px')
    expect(styles.width).toBe('320px')
    expect(styles.height).toBe('176px')
    expect(styles['padding-top']).toBe('24px')
    expect(styles['border-radius']).toBe('12px')
    expect(styles['background-color']).toBe('rgb(255, 255, 255)')
    expect(styles.color).toMatch(/^(oklch|rgb)\(/)
  })

  test('resolves Tailwind button alignment, spacing, and typography', async ({ page }) => {
    const css = await compileTailwindCSS(tailwindButtonClasses)
    await setStyledContent(
      page,
      css,
      `<button class="${tailwindButtonClasses.join(' ')}">Create design</button>`
    )

    const styles = await computedStyleProperties(page, 'button', [
      'align-items',
      'border-radius',
      'color',
      'display',
      'font-size',
      'font-weight',
      'gap',
      'justify-content',
      'padding-left',
      'padding-top'
    ])

    expect(styles.display).toBe('inline-flex')
    expect(styles['align-items']).toBe('center')
    expect(styles['justify-content']).toBe('center')
    expect(styles.gap).toBe('8px')
    expect(styles['padding-left']).toBe('16px')
    expect(styles['padding-top']).toBe('8px')
    expect(styles['font-size']).toBe('14px')
    expect(styles['font-weight']).toBe('500')
    expect(styles['border-radius']).toBe('6px')
    expect(styles.color).toBe('rgb(255, 255, 255)')
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
