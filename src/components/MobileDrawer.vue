<script setup lang="ts">
import { useElementSize, useSwipe, useWindowSize } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'
import LayerTree from './LayerTree.vue'
import PagesPanel from './PagesPanel.vue'
import { HALF_FRAC, HUD_TOP, SWIPE_THRESHOLD } from '@/constants'
import { useEditorStore } from '@/stores/editor'

type Snap = 'closed' | 'half' | 'full'

const store = useEditorStore()

const drawerRef = useTemplateRef<HTMLElement>('drawer')
const headerRef = useTemplateRef<HTMLElement>('header')

const { height: headerH } = useElementSize(headerRef, { width: 0, height: 56 })
const { height: windowH } = useWindowSize()

const snap = computed({
  get: (): Snap => store.state.mobileDrawerSnap,
  set: (v: Snap) => {
    store.state.mobileDrawerSnap = v
  }
})

const isLayersActive = computed(
  () => store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'layers'
)
const isDesignActive = computed(
  () => store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'design'
)

function selectTab(tab: 'panels' | 'code' | 'ai') {
  if (store.state.activeRibbonTab === tab && snap.value !== 'closed') {
    store.state.activeRibbonTab = null
    snap.value = 'closed'
    return
  }
  store.state.activeRibbonTab = tab
  if (snap.value === 'closed') snap.value = 'half'
}

function selectPanel(mode: 'layers' | 'design') {
  if (
    store.state.activeRibbonTab === 'panels' &&
    store.state.panelMode === mode &&
    snap.value !== 'closed'
  ) {
    store.state.activeRibbonTab = null
    snap.value = 'closed'
    return
  }
  store.state.activeRibbonTab = 'panels'
  store.state.panelMode = mode
  if (snap.value === 'closed') snap.value = 'half'
}

function snapHeight(s: Snap): number {
  switch (s) {
    case 'full':
      return windowH.value - HUD_TOP
    case 'half':
      return Math.round(windowH.value * HALF_FRAC)
    default:
      return headerH.value
  }
}

function swipeUp() {
  if (snap.value === 'closed') {
    if (!store.state.activeRibbonTab) store.state.activeRibbonTab = 'panels'
    snap.value = 'half'
  } else {
    snap.value = 'full'
  }
}

function swipeDown() {
  if (snap.value === 'full') {
    snap.value = 'half'
  } else {
    snap.value = 'closed'
    store.state.activeRibbonTab = null
  }
}

const dragOffset = ref(0)

const drawerSwipe = useSwipe(drawerRef, {
  threshold: SWIPE_THRESHOLD,
  onSwipe() {
    dragOffset.value = Math.max(0, -drawerSwipe.lengthY.value)
  },
  onSwipeEnd(_e, direction) {
    if (direction === 'up') swipeUp()
    else if (direction === 'down') swipeDown()
    requestAnimationFrame(() => {
      dragOffset.value = 0
    })
  }
})

const drawerTransform = computed(() => {
  if (drawerSwipe.isSwiping.value && dragOffset.value > 0) {
    return `translateY(${dragOffset.value}px)`
  }
  return 'translateY(0)'
})

const drawerHeight = computed(() => `${snapHeight(snap.value)}px`)

const isOpen = computed(() => snap.value !== 'closed')
</script>

<template>
  <div
    ref="drawer"
    data-test-id="mobile-drawer"
    class="fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-panel shadow-[0_-2px_10px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom)]"
    :class="drawerSwipe.isSwiping.value ? '' : 'transition-[height] duration-300 ease-out'"
    :style="{
      height: `calc(${drawerHeight} + env(safe-area-inset-bottom))`,
      transform: drawerTransform
    }"
  >
    <!-- Header: grab handle + tabs (always visible) -->
    <nav
      ref="header"
      aria-label="Mobile panel navigation"
      class="flex shrink-0 flex-col"
      role="tablist"
    >
      <div class="flex w-full justify-center pt-2">
        <div class="h-1 w-8 rounded-full bg-muted/40" />
      </div>
      <div class="flex w-full items-center px-2 py-2">
        <div
          role="tab"
          data-test-id="mobile-ribbon-layers"
          :aria-selected="isLayersActive"
          tabindex="0"
          class="flex h-full cursor-pointer items-center justify-center gap-1.5 px-4 text-xs outline-none transition-colors select-none"
          :class="isLayersActive ? 'text-accent' : 'text-muted'"
          @click="selectPanel('layers')"
        >
          <icon-lucide-layers class="size-4" />
        </div>

        <div
          role="tab"
          data-test-id="mobile-ribbon-design"
          :aria-selected="isDesignActive"
          tabindex="0"
          class="flex h-full cursor-pointer items-center justify-center gap-1.5 px-4 text-xs outline-none transition-colors select-none"
          :class="isDesignActive ? 'text-accent' : 'text-muted'"
          @click="selectPanel('design')"
        >
          <icon-lucide-sliders-horizontal class="size-4" />
        </div>

        <div class="flex-1" />

        <div
          role="tab"
          data-test-id="mobile-ribbon-code"
          :aria-selected="store.state.activeRibbonTab === 'code'"
          tabindex="0"
          class="flex h-full cursor-pointer items-center justify-center px-3 outline-none transition-colors select-none"
          :class="store.state.activeRibbonTab === 'code' ? 'text-accent' : 'text-muted'"
          @click="selectTab('code')"
        >
          <icon-lucide-code class="size-4" />
        </div>

        <div
          role="tab"
          data-test-id="mobile-ribbon-ai"
          :aria-selected="store.state.activeRibbonTab === 'ai'"
          tabindex="0"
          class="flex h-full cursor-pointer items-center justify-center px-3 outline-none transition-colors select-none"
          :class="store.state.activeRibbonTab === 'ai' ? 'text-accent' : 'text-muted'"
          @click="selectTab('ai')"
        >
          <icon-lucide-sparkles class="size-4" />
        </div>
      </div>
    </nav>

    <!-- Content (only when open) -->
    <template v-if="isOpen">
      <div
        data-test-id="mobile-drawer-content"
        class="min-h-0 flex-1 overflow-y-auto"
        @touchstart.stop
        @touchmove.stop
      >
        <div
          v-show="store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'layers'"
          data-test-id="mobile-drawer-layers"
          class="flex h-full flex-col"
        >
          <PagesPanel />
          <div class="border-t border-border" />
          <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
            Layers
          </header>
          <LayerTree class="min-h-0 flex-1" />
        </div>

        <div
          v-show="store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'design'"
          data-test-id="mobile-drawer-design"
          class="flex h-full flex-col"
        >
          <DesignPanel />
        </div>

        <div
          v-show="store.state.activeRibbonTab === 'code'"
          data-test-id="mobile-drawer-code"
          class="flex h-full flex-col"
        >
          <CodePanel />
        </div>

        <div
          v-show="store.state.activeRibbonTab === 'ai'"
          data-test-id="mobile-drawer-ai"
          class="flex h-full flex-col"
        >
          <ChatPanel />
        </div>
      </div>
    </template>
  </div>
</template>
