import type { Plugin } from 'vite'

export function automationPlugin(): Plugin {
  return {
    name: 'open-pencil-automation',
    configureServer() {
      import('./bridge').then(({ startAutomationBridge }) => {
        startAutomationBridge()
      })
    }
  }
}
