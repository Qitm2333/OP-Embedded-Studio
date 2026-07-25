import { VitePWA } from 'vite-plugin-pwa'

function assetUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${path.replace(/^\/+/, '')}`
}

export function openPencilPwaPlugin(base = '/') {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return VitePWA({
    registerType: 'autoUpdate',
    devOptions: { enabled: false },
    workbox: {
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,wasm,png,ico,ttf,webmanifest,bin,json}'],
      navigateFallback: assetUrl(normalizedBase, 'index.html')
    },
    manifest: {
      name: 'OP Embedded Studio',
      short_name: 'OP Embedded',
      description: 'Embedded UI design, prototyping, flashing, and wireless transfer studio',
      display: 'standalone',
      orientation: 'any',
      start_url: normalizedBase,
      scope: normalizedBase,
      theme_color: '#1e1e1e',
      background_color: '#1e1e1e',
      categories: ['design', 'productivity'],
      icons: [
        {
          src: assetUrl(normalizedBase, 'pwa-192.png'),
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: assetUrl(normalizedBase, 'pwa-512.png'),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any'
        },
        {
          src: assetUrl(normalizedBase, 'pwa-maskable-512.png'),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable'
        }
      ]
    }
  })
}
