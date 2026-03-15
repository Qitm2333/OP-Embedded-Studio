import { spawn } from 'node:child_process'

import type { Plugin } from 'vite'

export function automationPlugin(): Plugin {
  let child: ReturnType<typeof spawn> | null = null

  return {
    name: 'open-pencil-automation',
    configureServer() {
      if (child) return

      child = spawn('bun', ['run', 'packages/mcp/src/index.ts'], {
        stdio: 'inherit',
        env: { ...process.env, PORT: '7600', WS_PORT: '7601' }
      })

      child.on('exit', () => { child = null })
    },
    buildEnd() {
      child?.kill()
      child = null
    }
  }
}
