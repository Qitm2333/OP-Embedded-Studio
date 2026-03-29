import { computed, ref } from 'vue'

import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core'
import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useSceneComputed } from '@open-pencil/vue/internal/useSceneComputed'

export type ExportFormatId = 'png' | 'jpg' | 'webp' | 'svg' | 'fig'
export type ExportPanelTarget = 'selection' | 'page'

interface ExportSetting {
  scale: number
  format: ExportFormatId
}

const SCALES = [0.5, 0.75, 1, 1.5, 2, 3, 4] as const
const FORMATS: ExportFormatId[] = ['png', 'jpg', 'webp', 'svg', 'fig']
const io = new IORegistry(BUILTIN_IO_FORMATS)

function createDefaultSetting(): ExportSetting {
  return { scale: 1, format: 'png' }
}

export function useExport() {
  const editor = useEditor()

  const selectionSettings = ref<ExportSetting[]>([createDefaultSetting()])
  const pageSettings = ref<ExportSetting[]>([createDefaultSetting()])

  const selectedIds = useSceneComputed(() => [...editor.state.selectedIds])

  const formatSupportsScale = (format: ExportFormatId) =>
    io.getFormat(format)?.exportOptions?.scale ?? false

  const selectedNodeName = useSceneComputed(() => {
    const ids = editor.state.selectedIds
    if (ids.size === 1) {
      const id = [...ids][0]
      return editor.graph.getNode(id)?.name ?? 'Export'
    }
    if (ids.size > 1) return `${ids.size} layers`
    return null
  })

  const currentPageName = useSceneComputed(() => {
    const page = editor.graph.getNode(editor.state.currentPageId)
    return page?.name ?? 'Page'
  })

  const hasSelection = computed(() => selectedIds.value.length > 0)
  const activeTarget = computed<ExportPanelTarget>(() =>
    hasSelection.value ? 'selection' : 'page'
  )
  const activeName = computed(() =>
    activeTarget.value === 'selection' ? (selectedNodeName.value ?? 'Export') : currentPageName.value
  )
  const activeSettings = computed(() =>
    activeTarget.value === 'selection' ? selectionSettings.value : pageSettings.value
  )

  function addSelectionSetting() {
    const last = selectionSettings.value[selectionSettings.value.length - 1]
    const nextScale = SCALES.find((s) => s > (last?.scale ?? 1)) ?? 2
    selectionSettings.value.push({ scale: nextScale, format: last?.format ?? 'png' })
  }

  function addPageSetting() {
    const last = pageSettings.value[pageSettings.value.length - 1]
    const nextScale = SCALES.find((s) => s > (last?.scale ?? 1)) ?? 2
    pageSettings.value.push({ scale: nextScale, format: last?.format ?? 'png' })
  }

  function removeSelectionSetting(index: number) {
    selectionSettings.value.splice(index, 1)
  }

  function removePageSetting(index: number) {
    pageSettings.value.splice(index, 1)
  }

  function updateSelectionScale(index: number, scale: number) {
    selectionSettings.value[index] = { ...selectionSettings.value[index], scale }
  }

  function updatePageScale(index: number, scale: number) {
    pageSettings.value[index] = { ...pageSettings.value[index], scale }
  }

  function updateSelectionFormat(index: number, format: ExportFormatId) {
    selectionSettings.value[index] = { ...selectionSettings.value[index], format }
  }

  function updatePageFormat(index: number, format: ExportFormatId) {
    pageSettings.value[index] = { ...pageSettings.value[index], format }
  }

  return {
    editor,
    selectedIds,
    scales: SCALES,
    formats: FORMATS,
    formatSupportsScale,
    hasSelection,
    activeTarget,
    activeName,
    activeSettings,
    selectedNodeName,
    currentPageName,
    selectionSettings,
    pageSettings,
    addSelectionSetting,
    addPageSetting,
    removeSelectionSetting,
    removePageSetting,
    updateSelectionScale,
    updatePageScale,
    updateSelectionFormat,
    updatePageFormat
  }
}
