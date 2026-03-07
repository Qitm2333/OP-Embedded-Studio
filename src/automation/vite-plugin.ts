import type { Plugin } from 'vite'

export function automationPlugin(): Plugin {
  return {
    name: 'open-pencil-automation',
    configureServer(server) {
      import('./bridge').then(({ startAutomationBridge }) => {
        startAutomationBridge(server)
      })
    }
  }
}
