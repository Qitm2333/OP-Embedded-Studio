<script setup lang="ts">
import { computed } from 'vue'

import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

import { useI18n } from '@open-pencil/vue'
import { useEditorStore } from '@/app/editor/active-store'
import {
  bakeDevicePrototype,
  createDevicePrototypeFrameRenderer,
  getDevicePrototypeFrameCandidate,
  getSelectedDevicePrototypeFrameCandidates
} from '@/app/editor/device-prototype'
import {
  bakeEmbeddedFrame,
  bakeEmbeddedFrameById,
  getEmbeddedFrameBakeState
} from '@/app/editor/embedded-display-bake'
import { useAIChat } from '@/app/ai/chat/use'

import ChatPanel from './ChatPanel.vue'
import { DevicePrototypePanel, useDevicePrototype } from '@/features/device-prototype'
import { EmbeddedDisplayPanel } from '@/features/embedded-display'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'
import ZoomDropdown from './editor/ZoomDropdown.vue'

const { activeTab } = useAIChat()
const { panels } = useI18n()
const editorStore = useEditorStore()

const devicePrototypeFrame = computed(() => getDevicePrototypeFrameCandidate(editorStore))
const selectedDevicePrototypeFrames = computed(() =>
  getSelectedDevicePrototypeFrameCandidates(editorStore)
)
const devicePrototypeFrameRenderer = createDevicePrototypeFrameRenderer(editorStore)
const { interactionOptions, interactions } = useDevicePrototype(editorStore)
const embeddedBakeState = computed(() => getEmbeddedFrameBakeState(editorStore))

async function handleEmbeddedFrameBake() {
  return bakeEmbeddedFrame(editorStore)
}

async function handleEmbeddedFrameBakeById(frameId: string) {
  return bakeEmbeddedFrameById(editorStore, frameId)
}

async function handleEmbeddedPrototypeBake(interactionId: string) {
  const interaction = interactions.value.find((item) => item.id === interactionId)
  if (!interaction) return null
  return bakeDevicePrototype(editorStore, interaction)
}
</script>

<template>
  <aside
    data-test-id="properties-panel"
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <TabsRoot v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
      <TabsList class="flex h-10 shrink-0 items-center gap-0 border-b border-border px-1">
        <TabsTrigger
          value="design"
          data-test-id="properties-tab-design"
          class="min-w-0 flex-1 whitespace-nowrap rounded px-1 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          {{ panels.design }}
        </TabsTrigger>
        <TabsTrigger
          value="code"
          data-test-id="properties-tab-code"
          class="min-w-0 flex-1 whitespace-nowrap rounded px-1 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          {{ panels.code }}
        </TabsTrigger>
        <TabsTrigger
          value="ai"
          data-test-id="properties-tab-ai"
          class="min-w-0 flex-1 whitespace-nowrap rounded px-1 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          {{ panels.ai }}
        </TabsTrigger>
        <TabsTrigger
          value="prototype"
          data-test-id="properties-tab-prototype"
          class="min-w-0 flex-1 whitespace-nowrap rounded px-1 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          交互
        </TabsTrigger>
        <TabsTrigger
          value="embedded"
          data-test-id="properties-tab-embedded"
          class="min-w-0 flex-1 whitespace-nowrap rounded px-1 py-1 text-[11px] text-muted hover:text-surface data-[state=active]:font-semibold data-[state=active]:text-surface"
        >
          烧录
        </TabsTrigger>
        <ZoomDropdown v-if="activeTab === 'design'" />
      </TabsList>

      <TabsContent
        value="design"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'design'"
      >
        <DesignPanel />
      </TabsContent>

      <TabsContent
        value="code"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'code'"
      >
        <CodePanel />
      </TabsContent>

      <TabsContent
        value="ai"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'ai'"
      >
        <ChatPanel />
      </TabsContent>

      <TabsContent
        value="prototype"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'prototype'"
      >
        <DevicePrototypePanel
          :active="activeTab === 'prototype'"
          :scope-key="editorStore"
          :selected-frame="devicePrototypeFrame"
          :selected-frames="selectedDevicePrototypeFrames"
          :render-frame="devicePrototypeFrameRenderer"
          :render-revision="editorStore.state.sceneVersion"
        />
      </TabsContent>

      <TabsContent
        value="embedded"
        class="flex min-h-0 flex-1 flex-col"
        :force-mount="true"
        :hidden="activeTab !== 'embedded'"
      >
        <EmbeddedDisplayPanel
          :bake-state="embeddedBakeState"
          :bake-frame="handleEmbeddedFrameBake"
          :bake-frame-by-id="handleEmbeddedFrameBakeById"
          :prototype-options="interactionOptions"
          :bake-prototype="handleEmbeddedPrototypeBake"
        />
      </TabsContent>
    </TabsRoot>
  </aside>
</template>
