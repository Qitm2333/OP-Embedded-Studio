import process from 'node:process'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

import packageJson from './package.json'
import { createOpenPencilAliases } from './vite/aliases'
import { localAutomationToken, openPencilAutomationPlugin } from './vite/automation'
import { copyCanvasKitAssetsPlugin } from './vite/canvaskit-assets'
import { embeddedDisplayAssetsPlugin } from './vite/embedded-display-assets'
import { openPencilPwaPlugin } from './vite/pwa'
import { rawMarkdownPlugin } from './vite/raw-markdown'
import { createDevServerOptions } from './vite/server'

const host = process.env.TAURI_DEV_HOST

function appBaseUrl(): string {
  const configured = process.env.VITE_APP_BASE_URL?.trim()
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`
  if (process.env.GITHUB_PAGES !== 'true') return '/'
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/').at(-1) || 'OP-Embedded-Studio'
  return `/${repositoryName}/`
}

export default defineConfig(async ({ command }) => {
  const base = appBaseUrl()
  return {
    base,
    resolve: {
      alias: [
        ...createOpenPencilAliases(__dirname),
        {
          find: /^atob-lite$/,
          replacement: `${__dirname}/src/features/embedded-display/adapters/atob-lite.ts`
        }
      ],
      dedupe: ['@material/web']
    },
    define: {
      __OPENPENCIL_APP_VERSION__: JSON.stringify(packageJson.version),
      __OPENPENCIL_LOCAL_AUTOMATION_TOKEN__: JSON.stringify(localAutomationToken(command))
    },
    plugins: [
      rawMarkdownPlugin(),
      copyCanvasKitAssetsPlugin(),
      embeddedDisplayAssetsPlugin(),
      tailwindcss(),
      Icons({ compiler: 'vue3' }),
      Components({ resolvers: [IconsResolver({ prefix: 'icon' })] }),
      openPencilAutomationPlugin(command, host),
      vue({
        template: {
          compilerOptions: {
            isCustomElement: (tag) => tag === 'esp-web-install-button'
          }
        }
      }),
      openPencilPwaPlugin(base)
    ],
    clearScreen: false,
    optimizeDeps: {
      exclude: ['esp-web-tools']
    },
    build: {
      chunkSizeWarningLimit: 2500
    },
    server: createDevServerOptions(host)
  }
})
