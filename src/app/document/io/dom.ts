import type { Editor, EditorState } from '@open-pencil/core/editor'
import { browserHTMLToSceneGraph } from '@open-pencil/dom-css/browser'

import { yieldToUI } from '@/app/document/io/browser'
import { applyImportedDocument } from '@/app/document/io/imported-document'
import { toast } from '@/app/shell/ui'

type OpenDOMDocumentState = EditorState & {
  documentName: string
  loading: boolean
}

type OpenDOMFileOptions = {
  editor: Editor
  state: OpenDOMDocumentState
  setDocumentSource: (
    fileName: string,
    sourceFormat: string,
    handle?: FileSystemFileHandle,
    path?: string
  ) => void
  fitCurrentPageToViewport: () => Promise<void>
}

type DOMImportOptions = {
  cssText?: string
  handle?: FileSystemFileHandle
  path?: string
}

function documentNameFor(file: File): string {
  return file.name.replace(/\.(html?|xhtml)$/i, '')
}

export function createDOMOpenActions({
  editor,
  state,
  setDocumentSource,
  fitCurrentPageToViewport
}: OpenDOMFileOptions) {
  async function openDOMFile(file: File, options: DOMImportOptions = {}) {
    try {
      state.loading = true
      await yieldToUI()
      const html = await file.text()
      const pageName = documentNameFor(file)
      const graph = await browserHTMLToSceneGraph(html, { cssText: options.cssText, pageName })
      await yieldToUI()
      await applyImportedDocument(editor, graph)
      state.documentName = pageName
      setDocumentSource(file.name, 'html', options.handle, options.path)
      await fitCurrentPageToViewport()
      editor.requestRender()
    } catch (e) {
      console.error('Failed to open DOM/CSS file:', e)
      toast.error(`Failed to open DOM/CSS file: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      state.loading = false
    }
  }

  return { openDOMFile }
}
