import type { Page } from '@playwright/test'

import { compileTailwindCSS } from '@open-pencil/dom-css'

import {
  fixtureMatrixCSS,
  fixtureMatrixHTML,
  tailwindBadgeClasses,
  tailwindButtonClasses,
  tailwindCardClasses,
  tailwindInputClasses,
  tailwindNavClasses
} from '#tests/helpers/dom-css'

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

  test('resolves fixture matrix layout, form, badge, and dialog styles', async ({ page }) => {
    await setStyledContent(page, fixtureMatrixCSS, fixtureMatrixHTML)

    const navbar = await computedStyleProperties(page, '.navbar', [
      'align-items',
      'border-radius',
      'display',
      'height',
      'justify-content',
      'padding-left',
      'width'
    ])
    expect(navbar.display).toBe('flex')
    expect(navbar['align-items']).toBe('center')
    expect(navbar['justify-content']).toBe('space-between')
    expect(navbar.width).toBe('416px')
    expect(navbar.height).toBe('48px')
    expect(navbar['padding-left']).toBe('16px')
    expect(navbar['border-radius']).toBe('12px')

    const badge = await computedStyleProperties(page, '.badge', [
      'align-items',
      'background-color',
      'border-radius',
      'color',
      'display',
      'font-size',
      'font-weight',
      'height',
      'justify-content',
      'padding-left'
    ])
    expect(badge.display).toBe('flex')
    expect(badge['align-items']).toBe('center')
    expect(badge['justify-content']).toBe('center')
    expect(badge.height).toBe('24px')
    expect(badge['padding-left']).toBe('10px')
    expect(badge['border-radius']).toBe('9999px')
    expect(badge['font-size']).toBe('12px')
    expect(badge['font-weight']).toBe('600')
    expect(badge['background-color']).toBe('rgb(224, 242, 254)')
    expect(badge.color).toBe('rgb(3, 105, 161)')

    const input = await computedStyleProperties(page, '.input', [
      'border-bottom-width',
      'border-radius',
      'font-size',
      'height',
      'padding-left',
      'width'
    ])
    expect(input.width).toBe('312px')
    expect(input.height).toBe('40px')
    expect(input['padding-left']).toBe('12px')
    expect(input['border-radius']).toBe('8px')
    expect(input['border-bottom-width']).toBe('1px')
    expect(input['font-size']).toBe('14px')

    const dialog = await computedStyleProperties(page, '.dialog', [
      'box-shadow',
      'display',
      'flex-direction',
      'gap',
      'max-width',
      'min-width',
      'padding-top',
      'width'
    ])
    expect(dialog.display).toBe('flex')
    expect(dialog['flex-direction']).toBe('column')
    expect(dialog.gap).toBe('16px')
    expect(dialog.width).toBe('360px')
    expect(dialog['min-width']).toBe('320px')
    expect(dialog['max-width']).toBe('420px')
    expect(dialog['padding-top']).toBe('24px')
    expect(dialog['box-shadow']).toContain('rgba(15, 23, 42, 0.16)')
  })

  test('resolves Tailwind input, badge, and nav utilities in a real browser', async ({ page }) => {
    const inputClasses = [...tailwindInputClasses]
    const badgeClasses = [...tailwindBadgeClasses]
    const navClasses = [...tailwindNavClasses]
    const css = await compileTailwindCSS([...inputClasses, ...badgeClasses, ...navClasses])
    await setStyledContent(
      page,
      css,
      `
        <nav class="${navClasses.join(' ')}">
          <span>OpenPencil</span>
          <span class="${badgeClasses.join(' ')}">Beta</span>
        </nav>
        <input class="${inputClasses.join(' ')}" value="https://openpencil.dev" />
      `
    )

    const nav = await computedStyleProperties(page, 'nav', [
      'align-items',
      'border-radius',
      'display',
      'height',
      'justify-content',
      'padding-left',
      'width'
    ])
    expect(nav.display).toBe('flex')
    expect(nav['align-items']).toBe('center')
    expect(nav['justify-content']).toBe('space-between')
    expect(nav.width).toBe('384px')
    expect(nav.height).toBe('48px')
    expect(nav['padding-left']).toBe('16px')
    expect(nav['border-radius']).toBe('12px')

    const badge = await computedStyleProperties(page, 'nav span:last-child', [
      'align-items',
      'border-radius',
      'display',
      'font-size',
      'font-weight',
      'height',
      'justify-content',
      'padding-left'
    ])
    expect(badge.display).toBe('flex')
    expect(badge['align-items']).toBe('center')
    expect(badge['justify-content']).toBe('center')
    expect(badge.height).toBe('24px')
    expect(badge['padding-left']).toBe('10px')
    expect(badge['border-radius']).toMatch(/^3\.\d+e\+\d+px$/)
    expect(badge['font-size']).toBe('12px')
    expect(badge['font-weight']).toBe('600')

    const input = await computedStyleProperties(page, 'input', [
      'border-bottom-width',
      'border-radius',
      'font-size',
      'height',
      'padding-left',
      'width'
    ])
    expect(input.width).toBe('320px')
    expect(input.height).toBe('40px')
    expect(input['padding-left']).toBe('12px')
    expect(input['border-radius']).toBe('6px')
    expect(input['border-bottom-width']).toBe('1px')
    expect(input['font-size']).toBe('14px')
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
