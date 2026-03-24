import { computed } from 'vue'

import { useEditor } from '@open-pencil/vue/context/editorContext'
import { useSceneComputed } from '@open-pencil/vue/internal/useSceneComputed'

export function usePageList() {
  const editor = useEditor()

  const pages = useSceneComputed(() => editor.graph.getPages())
  const currentPageId = computed(() => editor.state.currentPageId)

  return {
    editor,
    pages,
    currentPageId,
    switchPage: editor.switchPage,
    addPage: editor.addPage,
    deletePage: editor.deletePage,
    renamePage: editor.renamePage
  }
}
