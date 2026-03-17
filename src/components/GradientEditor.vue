<script setup lang="ts">
import { computed, ref } from 'vue'

import AppSelect from './AppSelect.vue'
import HsvColorArea from './HsvColorArea.vue'
import ScrubInput from './ScrubInput.vue'
import { colorToCSS, colorToHexRaw, parseColor } from '@open-pencil/core'

import type { Color, Fill, GradientStop, GradientTransform } from '@open-pencil/core'

type GradientSubtype =
  | 'GRADIENT_LINEAR'
  | 'GRADIENT_RADIAL'
  | 'GRADIENT_ANGULAR'
  | 'GRADIENT_DIAMOND'

const GRADIENT_SUBTYPES: { value: GradientSubtype; label: string }[] = [
  { value: 'GRADIENT_LINEAR', label: 'Linear' },
  { value: 'GRADIENT_RADIAL', label: 'Radial' },
  { value: 'GRADIENT_ANGULAR', label: 'Angular' },
  { value: 'GRADIENT_DIAMOND', label: 'Diamond' }
]

const DEFAULT_GRADIENT_TRANSFORMS: Record<GradientSubtype, GradientTransform> = {
  GRADIENT_LINEAR: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 },
  GRADIENT_RADIAL: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
  GRADIENT_ANGULAR: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 },
  GRADIENT_DIAMOND: { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }
}

const { fill } = defineProps<{ fill: Fill }>()

const emit = defineEmits<{ update: [fill: Fill] }>()

const activeStopIndex = ref(0)
const gradientStopBarRef = ref<HTMLDivElement | null>(null)
const draggingStopIndex = ref<number | null>(null)

const stops = computed(() => fill.gradientStops ?? [])

const subtype = computed({
  get: () => fill.type as GradientSubtype,
  set: (type: GradientSubtype) => {
    if (type === fill.type) return
    emit('update', {
      ...fill,
      type,
      gradientTransform: DEFAULT_GRADIENT_TRANSFORMS[type]
    })
  }
})

const activeColor = computed(() => {
  const s = stops.value
  if (!s.length) return fill.color
  return s[Math.min(activeStopIndex.value, s.length - 1)].color
})

function emitStops(newStops: GradientStop[]) {
  emit('update', { ...fill, gradientStops: newStops })
}

function selectStop(index: number) {
  activeStopIndex.value = index
}

function addStop() {
  const s = [...stops.value]
  const pos = s.length >= 2 ? (s[s.length - 2].position + s[s.length - 1].position) / 2 : 0.5
  s.push({ color: { ...activeColor.value }, position: pos })
  s.sort((a, b) => a.position - b.position)
  activeStopIndex.value = s.findIndex((stop) => stop.position === pos)
  emitStops(s)
}

function removeStop(index: number) {
  if (stops.value.length <= 2) return
  const s = stops.value.filter((_, i) => i !== index)
  activeStopIndex.value = Math.min(activeStopIndex.value, s.length - 1)
  emitStops(s)
}

function updateStopPosition(index: number, value: number) {
  const s = [...stops.value]
  s[index] = { ...s[index], position: Math.max(0, Math.min(1, value / 100)) }
  emitStops(s)
}

function updateStopColor(index: number, hex: string) {
  const color = parseColor(hex.startsWith('#') ? hex : `#${hex}`)
  if (!color) return
  const s = [...stops.value]
  s[index] = { ...s[index], color: { ...color, a: s[index].color.a } }
  emitStops(s)
}

function updateStopOpacity(index: number, value: number) {
  const s = [...stops.value]
  s[index] = { ...s[index], color: { ...s[index].color, a: Math.max(0, Math.min(1, value / 100)) } }
  emitStops(s)
}

function onActiveColorUpdate(color: Color) {
  const s = [...stops.value]
  const idx = Math.min(activeStopIndex.value, s.length - 1)
  s[idx] = { ...s[idx], color }
  emitStops(s)
}

function onStopPointerDown(index: number, e: PointerEvent) {
  selectStop(index)
  draggingStopIndex.value = index
  gradientStopBarRef.value?.setPointerCapture(e.pointerId)
}

function onStopBarPointerMove(e: PointerEvent) {
  const el = gradientStopBarRef.value
  if (!el || draggingStopIndex.value === null || !el.hasPointerCapture(e.pointerId)) return
  const rect = el.getBoundingClientRect()
  const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const s = [...stops.value]
  s[draggingStopIndex.value] = { ...s[draggingStopIndex.value], position: pos }
  emitStops(s)
}

function onStopBarPointerUp() {
  draggingStopIndex.value = null
}

function gradientCSS(stopsArr: GradientStop[]): string {
  return stopsArr.map((s) => `${colorToCSS(s.color)} ${s.position * 100}%`).join(', ')
}

const barBackground = computed(() =>
  stops.value.length ? `linear-gradient(to right, ${gradientCSS(stops.value)})` : ''
)
</script>

<template>
  <div>
    <div class="mb-2 w-28">
      <AppSelect v-model="subtype" :options="GRADIENT_SUBTYPES" />
    </div>

    <!-- Stop bar -->
    <div
      ref="gradientStopBarRef"
      data-test-id="fill-picker-gradient-bar"
      class="relative mb-2 h-6 rounded"
      :style="{ background: barBackground }"
      @pointermove="onStopBarPointerMove"
      @pointerup="onStopBarPointerUp"
    >
      <div
        v-for="(stop, idx) in stops"
        :key="idx"
        class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-sm border-2 shadow-sm"
        :class="idx === activeStopIndex ? 'border-white' : 'border-white/60'"
        :style="{ left: `${stop.position * 100}%`, background: colorToCSS(stop.color) }"
        @pointerdown.stop="onStopPointerDown(idx, $event)"
      />
    </div>

    <!-- Stop list -->
    <div class="mb-2">
      <div class="mb-1 flex items-center justify-between">
        <span class="text-[11px] text-muted">Stops</span>
        <button
          class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
          data-test-id="fill-picker-add-stop"
          title="Add stop"
          @click="addStop"
        >
          <icon-lucide-plus class="size-3" />
        </button>
      </div>
      <div
        v-for="(stop, idx) in stops"
        :key="idx"
        class="flex items-center gap-1 py-0.5"
        :class="{ 'rounded bg-hover/50': idx === activeStopIndex }"
        @click="selectStop(idx)"
      >
        <ScrubInput
          class="w-11"
          suffix="%"
          :model-value="Math.round(stop.position * 100)"
          :min="0"
          :max="100"
          @update:model-value="updateStopPosition(idx, Number($event))"
          @click.stop
        />
        <button
          class="size-4 shrink-0 cursor-pointer rounded border border-border p-0"
          :style="{ background: colorToCSS(stop.color) }"
          @click.stop="selectStop(idx)"
        />
        <input
          class="min-w-0 flex-1 rounded border border-border bg-input px-1 py-0.5 font-mono text-[11px] text-surface"
          :value="colorToHexRaw(stop.color)"
          maxlength="6"
          @change="updateStopColor(idx, ($event.target as HTMLInputElement).value)"
          @click.stop
        />
        <ScrubInput
          class="w-9"
          suffix="%"
          :model-value="Math.round(stop.color.a * 100)"
          :min="0"
          :max="100"
          @update:model-value="updateStopOpacity(idx, Number($event))"
          @click.stop
        />
        <button
          v-if="stops.length > 2"
          class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
          @click.stop="removeStop(idx)"
        >
          −
        </button>
      </div>
    </div>

    <HsvColorArea :color="activeColor" @update="onActiveColorUpdate" />
  </div>
</template>
