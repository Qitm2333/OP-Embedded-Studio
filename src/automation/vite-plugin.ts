import type { Plugin } from 'vite'

export function automationPlugin(): Plugin {
  return {
    name: 'open-pencil-automation',
    configureServer() {
      void import('./bridge')
    }
  }
}
