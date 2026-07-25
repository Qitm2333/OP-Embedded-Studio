import { createReadStream } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

const ASSET_ROUTE = '/embedded-display/firmware/'
const FIRMWARE_PARTS = [
  { path: './bootloader.bin', offset: 0x0000 },
  { path: './partition-table.bin', offset: 0x8000 },
  { path: './st7789_simple.bin', offset: 0x10000 },
  { path: './content-reset.bin', offset: 0x310000 }
]

function firmwareManifest(mode: string, profileId: string) {
  return {
    name: `OP Embedded Studio ${mode}`,
    version: profileId,
    buildMode: mode,
    new_install_prompt_erase: true,
    builds: [{ chipFamily: 'ESP32-S3', parts: FIRMWARE_PARTS }]
  }
}

function contentType(filePath: string): string {
  return filePath.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/octet-stream'
}

async function firmwareDirectories(
  root: string
): Promise<Array<{ mode: string; profileId: string }>> {
  const directories: Array<{ mode: string; profileId: string }> = []
  for (const modeEntry of await readdir(root, { withFileTypes: true })) {
    if (!modeEntry.isDirectory()) continue
    const modePath = path.join(root, modeEntry.name)
    for (const profileEntry of await readdir(modePath, { withFileTypes: true })) {
      if (profileEntry.isDirectory()) {
        directories.push({ mode: modeEntry.name, profileId: profileEntry.name })
      }
    }
  }
  return directories
}

export function embeddedDisplayAssetsPlugin(): Plugin {
  const firmwareRoot = fileURLToPath(
    new URL('../tools/embedded-display/prebuilt-firmware', import.meta.url)
  )
  return {
    name: 'embedded-display-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname
        if (!pathname.startsWith(ASSET_ROUTE)) return next()

        const relativePath = decodeURIComponent(pathname.slice(ASSET_ROUTE.length))
        const segments = relativePath.split('/').filter(Boolean)
        if (segments.length === 3 && segments[2] === 'manifest.json') {
          const directory = path.resolve(firmwareRoot, segments[0], segments[1])
          if (!directory.startsWith(`${firmwareRoot}${path.sep}`)) {
            response.statusCode = 400
            response.end('Invalid firmware path')
            return
          }
          try {
            await stat(path.join(directory, 'st7789_simple.bin'))
            response.setHeader('Content-Type', contentType('manifest.json'))
            response.end(JSON.stringify(firmwareManifest(segments[0], segments[1])))
          } catch {
            next()
          }
          return
        }

        const filePath = path.resolve(firmwareRoot, relativePath)
        if (!filePath.startsWith(`${firmwareRoot}${path.sep}`)) {
          response.statusCode = 400
          response.end('Invalid firmware path')
          return
        }
        try {
          const fileStat = await stat(filePath)
          if (!fileStat.isFile()) return next()
          response.setHeader('Content-Type', contentType(filePath))
          response.setHeader('Content-Length', fileStat.size)
          createReadStream(filePath).pipe(response)
        } catch {
          next()
        }
      })
    },
    async generateBundle() {
      for (const { mode, profileId } of await firmwareDirectories(firmwareRoot)) {
        const directory = path.join(firmwareRoot, mode, profileId)
        for (const part of FIRMWARE_PARTS) {
          const fileName = part.path.slice(2)
          this.emitFile({
            type: 'asset',
            fileName: `embedded-display/firmware/${mode}/${profileId}/${fileName}`,
            source: await readFile(path.join(directory, fileName))
          })
        }
        this.emitFile({
          type: 'asset',
          fileName: `embedded-display/firmware/${mode}/${profileId}/manifest.json`,
          source: JSON.stringify(firmwareManifest(mode, profileId), null, 2)
        })
      }
    }
  }
}
