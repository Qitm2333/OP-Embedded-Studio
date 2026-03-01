<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAIChat } from '@/composables/use-chat'
import { useEditorStore } from '@/stores/editor'

import ChatPanel from './ChatPanel.vue'
import VariablesDialog from './VariablesDialog.vue'
import AppearanceSection from './properties/AppearanceSection.vue'
import EffectsSection from './properties/EffectsSection.vue'
import ExportSection from './properties/ExportSection.vue'
import FillSection from './properties/FillSection.vue'
import LayoutSection from './properties/LayoutSection.vue'
import PageSection from './properties/PageSection.vue'
import PositionSection from './properties/PositionSection.vue'
import StrokeSection from './properties/StrokeSection.vue'
import TypographySection from './properties/TypographySection.vue'
import VariablesSection from './properties/VariablesSection.vue'

const store = useEditorStore()
const { activeTab } = useAIChat()
const variablesOpen = ref(false)

const node = computed(() => store.selectedNode.value)
const multiCount = computed(() => store.selectedNodes.value.length)
const isComponentType = computed(() => {
  const t = node.value?.type
  return t === 'COMPONENT' || t === 'COMPONENT_SET' || t === 'INSTANCE'
})
</script>

<template>
  <aside
    class="flex min-w-0 flex-1 flex-col overflow-hidden border-l border-border bg-panel"
    style="contain: paint layout style"
  >
    <!-- Tabs -->
    <div class="flex h-10 shrink-0 items-center gap-1 border-b border-border px-2">
      <button
        class="rounded px-2.5 py-1 text-xs"
        :class="
          activeTab === 'design' ? 'font-semibold text-surface' : 'text-muted hover:text-surface'
        "
        @click="activeTab = 'design'"
      >
        Design
      </button>
      <button
        class="flex items-center gap-1 rounded px-2.5 py-1 text-xs"
        :class="activeTab === 'ai' ? 'font-semibold text-surface' : 'text-muted hover:text-surface'"
        @click="activeTab = 'ai'"
      >
        <icon-lucide-sparkles class="size-3" />
        AI
      </button>
      <span
        v-if="activeTab === 'design'"
        class="ml-auto cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-hover"
      >
        {{ Math.round(store.state.zoom * 100) }}%
      </span>
    </div>

    <!-- AI Chat tab -->
    <ChatPanel v-if="activeTab === 'ai'" />

    <!-- Design tab -->
    <template v-else>
      <!-- Multi-select summary -->
      <div v-if="multiCount > 1" class="flex-1 overflow-y-auto pb-4">
        <div class="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span class="text-[11px] text-muted">Mixed</span>
          <span class="text-xs font-semibold">{{ multiCount }} layers</span>
        </div>
        <AppearanceSection />
      </div>

      <!-- Single selection -->
      <div v-else-if="node" class="flex-1 overflow-y-auto pb-4">
        <!-- Node header -->
        <div class="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span class="text-[11px]" :class="isComponentType ? 'text-[#9747ff]' : 'text-muted'">{{
            node.type
          }}</span>
          <span class="text-xs font-semibold">{{ node.name }}</span>
        </div>

        <!-- Component actions -->
        <div
          v-if="node.type === 'INSTANCE'"
          class="flex flex-col gap-1 border-b border-border px-3 py-2"
        >
          <button
            class="rounded bg-[#9747ff]/10 px-2 py-1 text-left text-[11px] text-[#9747ff] hover:bg-[#9747ff]/20"
            @click="store.goToMainComponent()"
          >
            Go to Main Component
          </button>
          <button
            class="rounded px-2 py-1 text-left text-[11px] text-muted hover:bg-hover"
            @click="store.detachInstance()"
          >
            Detach Instance
          </button>
        </div>

        <PositionSection />
        <LayoutSection />
        <AppearanceSection />
        <TypographySection v-if="node.type === 'TEXT'" />
        <FillSection />
        <StrokeSection />
        <EffectsSection />

        <ExportSection />
      </div>

      <div v-else class="flex-1 overflow-y-auto pb-4">
        <PageSection />
        <VariablesSection @open-dialog="variablesOpen = true" />
      </div>

      <VariablesDialog v-model:open="variablesOpen" />
    </template>
  </aside>
</template>
