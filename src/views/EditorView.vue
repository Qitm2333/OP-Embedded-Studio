<script setup lang="ts">
import { useEventListener, useUrlSearchParams } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { SplitterGroup, SplitterPanel, SplitterResizeHandle } from 'reka-ui'

import { useKeyboard } from '@/composables/use-keyboard'
import { useMenu } from '@/composables/use-menu'
import { useCollab } from '@/composables/use-collab'
import { createDemoShapes } from '@/demo'
import { provideEditorStore } from '@/stores/editor'

import CollabPanel from '@/components/CollabPanel.vue'
import EditorCanvas from '@/components/EditorCanvas.vue'
import LayersPanel from '@/components/LayersPanel.vue'
import PropertiesPanel from '@/components/PropertiesPanel.vue'
import SafariBanner from '@/components/SafariBanner.vue'
import Toolbar from '@/components/Toolbar.vue'

const route = useRoute()
const router = useRouter()

const store = provideEditorStore()
useKeyboard(store)
useMenu(store)
const collab = useCollab(store)
;(window as Window & { __OPEN_PENCIL_STORE__?: typeof store }).__OPEN_PENCIL_STORE__ = store

useEventListener(
  document,
  'wheel',
  (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) e.preventDefault()
  },
  { passive: false }
)

const params = useUrlSearchParams('history')
const showChrome = !('no-chrome' in params)
if (!('test' in params)) {
  createDemoShapes(store)
}

const pendingRoomId = (route.params.roomId as string) || null

function onShare() {
  const roomId = collab.shareCurrentDoc()
  router.push(`/share/${roomId}`)
}

function onJoin(roomId: string) {
  collab.connect(roomId)
  router.push(`/share/${roomId}`)
}

function onDisconnect() {
  collab.disconnect()
  router.push('/')
}
</script>

<template>
  <div class="flex h-screen w-screen flex-col">
    <SafariBanner />
    <SplitterGroup
      v-if="showChrome"
      direction="horizontal"
      class="flex-1 overflow-hidden"
      auto-save-id="editor-layout"
    >
      <SplitterPanel :default-size="18" :min-size="10" :max-size="30" class="flex">
        <LayersPanel />
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel :default-size="64" :min-size="30" class="flex">
        <div class="relative flex min-w-0 flex-1">
          <EditorCanvas />
          <Toolbar />
        </div>
      </SplitterPanel>
      <SplitterResizeHandle class="group relative z-10 -mx-1 w-2 cursor-col-resize">
        <div class="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2" />
      </SplitterResizeHandle>
      <SplitterPanel :default-size="18" :min-size="10" :max-size="30" class="flex flex-col">
        <div
          class="flex shrink-0 items-center justify-between border-b border-border px-1.5 py-1.5"
        >
          <CollabPanel
            :state="collab.state.value"
            :peers="collab.remotePeers.value"
            :pending-room-id="pendingRoomId"
            @share="onShare"
            @join="onJoin"
            @disconnect="onDisconnect"
            @update:name="collab.setLocalName"
          />
        </div>
        <PropertiesPanel />
      </SplitterPanel>
    </SplitterGroup>
    <div v-else class="flex flex-1 overflow-hidden">
      <div class="relative flex min-w-0 flex-1">
        <EditorCanvas />
      </div>
    </div>
  </div>
</template>
