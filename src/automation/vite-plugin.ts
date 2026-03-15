import type { Plugin } from 'vite'

export function automationPlugin(): Plugin {
  return {
    name: 'open-pencil-automation',
    configureServer(server) {
      server.ssrLoadModule('./src/automation/bridge').catch((e) => {
        console.error('Failed to start automation bridge:', e)
      })
    }
  }
}
