import { computed, ref } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/useSceneComputed'

import type {
  SceneNode,
  LayoutSizing,
  LayoutAlign,
  LayoutCounterAlign,
  GridTrack
} from '@open-pencil/core'

type AlignCell = { primary: LayoutAlign; counter: LayoutCounterAlign }

const ALIGN_HORIZONTAL: AlignCell[] = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MAX' }
]

const ALIGN_VERTICAL: AlignCell[] = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MAX', counter: 'MAX' }
]

function createTrackSizingOptions(panels: ReturnType<typeof useI18n>['panels']['value']) {
  return [
    { value: 'FR' as const, label: panels.sizingFillFr },
    { value: 'FIXED' as const, label: panels.sizingFixedPx },
    { value: 'AUTO' as const, label: panels.auto }
  ]
}

/**
 * Returns layout-related state and actions for the current selection.
 *
 * Use this composable to build auto-layout and grid panels that need sizing,
 * padding, alignment, and track editing behavior.
 */
export function useLayout() {
  const editor = useEditor()
  const { panels } = useI18n()

  const node = useSceneComputed<SceneNode | null>(() => editor.getSelectedNode() ?? null)
  const layoutDirection = computed<SceneNode['layoutDirection']>(
    () => node.value?.layoutDirection ?? 'AUTO'
  )

  const isInAutoLayout = computed(() => {
    const n = node.value
    if (!n?.parentId) return false
    const parent = editor.getNode(n.parentId)
    return parent ? parent.layoutMode !== 'NONE' : false
  })

  const isGrid = computed(() => node.value?.layoutMode === 'GRID')
  const isFlex = computed(
    () => node.value?.layoutMode === 'HORIZONTAL' || node.value?.layoutMode === 'VERTICAL'
  )

  const widthSizing = computed<LayoutSizing>(() => {
    const n = node.value
    if (!n) return 'FIXED'
    if (isFlex.value)
      return n.layoutMode === 'HORIZONTAL' ? n.primaryAxisSizing : n.counterAxisSizing
    if (isInAutoLayout.value && n.layoutGrow > 0) return 'FILL'
    return 'FIXED'
  })

  const heightSizing = computed<LayoutSizing>(() => {
    const n = node.value
    if (!n) return 'FIXED'
    if (isFlex.value) return n.layoutMode === 'VERTICAL' ? n.primaryAxisSizing : n.counterAxisSizing
    if (isInAutoLayout.value && n.layoutAlignSelf === 'STRETCH') return 'FILL'
    return 'FIXED'
  })

  const widthSizingOptions = computed(() => {
    const options: { value: LayoutSizing; label: string }[] = [
      { value: 'FIXED', label: panels.value.sizingFixed }
    ]
    if (isFlex.value) options.push({ value: 'HUG', label: panels.value.sizingHug })
    if (isInAutoLayout.value || isFlex.value)
      options.push({ value: 'FILL', label: panels.value.sizingFill })
    return options
  })

  const heightSizingOptions = computed(() => {
    const options: { value: LayoutSizing; label: string }[] = [
      { value: 'FIXED', label: panels.value.sizingFixed }
    ]
    if (isFlex.value) options.push({ value: 'HUG', label: panels.value.sizingHug })
    if (isInAutoLayout.value || isFlex.value)
      options.push({ value: 'FILL', label: panels.value.sizingFill })
    return options
  })

  const alignGrid = computed(() =>
    node.value?.layoutMode === 'VERTICAL' ? ALIGN_VERTICAL : ALIGN_HORIZONTAL
  )

  const showIndividualPadding = ref(false)

  const hasUniformPadding = computed(() => {
    const n = node.value
    if (!n) return true
    return (
      n.paddingTop === n.paddingRight &&
      n.paddingRight === n.paddingBottom &&
      n.paddingBottom === n.paddingLeft
    )
  })

  function updateProp(key: string, value: number | string) {
    if (node.value) editor.updateNode(node.value.id, { [key]: value })
  }

  function commitProp(key: string, _value: number | string, previous: number | string) {
    if (node.value)
      editor.commitNodeUpdate(
        node.value.id,
        { [key]: previous } as Partial<SceneNode>,
        `Change ${key}`
      )
  }

  function setWidthSizing(sizing: LayoutSizing) {
    if (!node.value) return
    if (isFlex.value) {
      const key = node.value.layoutMode === 'HORIZONTAL' ? 'primaryAxisSizing' : 'counterAxisSizing'
      updateProp(key, sizing)
    } else if (isInAutoLayout.value) {
      updateProp('layoutGrow', sizing === 'FILL' ? 1 : 0)
    }
  }

  function setHeightSizing(sizing: LayoutSizing) {
    if (!node.value) return
    if (isFlex.value) {
      const key = node.value.layoutMode === 'VERTICAL' ? 'primaryAxisSizing' : 'counterAxisSizing'
      updateProp(key, sizing)
    } else if (isInAutoLayout.value) {
      updateProp('layoutAlignSelf', sizing === 'FILL' ? 'STRETCH' : 'AUTO')
    }
  }

  function setUniformPadding(v: number) {
    if (!node.value) return
    editor.updateNode(node.value.id, {
      paddingTop: v,
      paddingRight: v,
      paddingBottom: v,
      paddingLeft: v
    })
  }

  function commitUniformPadding(_value: number, previous: number) {
    if (!node.value) return
    editor.commitNodeUpdate(
      node.value.id,
      {
        paddingTop: previous,
        paddingRight: previous,
        paddingBottom: previous,
        paddingLeft: previous
      } as unknown as Partial<SceneNode>,
      'Change padding'
    )
  }

  function setAlignment(primary: LayoutAlign, counter: LayoutCounterAlign) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { primaryAxisAlign: primary, counterAxisAlign: counter },
      'Change alignment'
    )
  }

  function setLayoutDirection(direction: SceneNode['layoutDirection']) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { layoutDirection: direction },
      'Change layout direction'
    )
  }

  function updateGridTrack(
    prop: 'gridTemplateColumns' | 'gridTemplateRows',
    index: number,
    updates: Partial<GridTrack>
  ) {
    if (!node.value) return
    const tracks = [...node.value[prop]]
    tracks[index] = { ...tracks[index], ...updates }
    editor.updateNodeWithUndo(node.value.id, { [prop]: tracks }, 'Change grid track')
  }

  function addTrack(prop: 'gridTemplateColumns' | 'gridTemplateRows') {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { [prop]: [...node.value[prop], { sizing: 'FR' as const, value: 1 }] },
      'Add grid track'
    )
  }

  function removeTrack(prop: 'gridTemplateColumns' | 'gridTemplateRows', index: number) {
    if (!node.value) return
    editor.updateNodeWithUndo(
      node.value.id,
      { [prop]: node.value[prop].filter((_: GridTrack, i: number) => i !== index) },
      'Remove grid track'
    )
  }

  function trackLabel(track: GridTrack): string {
    if (track.sizing === 'FR') return `${track.value}fr`
    if (track.sizing === 'FIXED') return `${track.value}px`
    return 'Auto'
  }

  function toggleIndividualPadding() {
    showIndividualPadding.value = !showIndividualPadding.value
  }

  return {
    editor,
    node,
    layoutDirection,
    isInAutoLayout,
    isGrid,
    isFlex,
    widthSizing,
    heightSizing,
    widthSizingOptions,
    heightSizingOptions,
    alignGrid,
    showIndividualPadding,
    hasUniformPadding,
    trackSizingOptions: createTrackSizingOptions(panels.value),
    updateProp,
    commitProp,
    setWidthSizing,
    setHeightSizing,
    setUniformPadding,
    commitUniformPadding,
    setAlignment,
    setLayoutDirection,
    updateGridTrack,
    addTrack,
    removeTrack,
    trackLabel,
    toggleIndividualPadding
  }
}
