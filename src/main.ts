import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { preloadFonts } from '@/app/editor/fonts'
import { IS_TAURI } from '@/constants'

import App from './App.vue'
import router from './router'

async function clearDevelopmentPwa(): Promise<boolean> {
  if (!import.meta.env.DEV || IS_TAURI || !('serviceWorker' in navigator)) return false

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    const controlledByServiceWorker = navigator.serviceWorker.controller !== null
    const unregisterResults = await Promise.all(
      registrations.map((registration) => registration.unregister())
    )

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    }

    if (controlledByServiceWorker && unregisterResults.some(Boolean)) {
      location.reload()
      return true
    }
  } catch (error) {
    console.warn('[pwa] Could not clear development service worker state', error)
  }
  return false
}

async function startApp() {
  if (await clearDevelopmentPwa()) return

  preloadFonts()
  const head = createHead()
  createApp(App).use(router).use(head).mount('#app')
}

void startApp()

if (import.meta.env.PROD && !IS_TAURI) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true })
    return undefined
  })
}
