interface FilePickerAcceptType {
  description: string
  accept: Record<string, string[]>
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[]
  suggestedName?: string
}

interface Window {
  showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>
  queryLocalFonts?(): Promise<
    {
      family: string
      fullName: string
      style: string
      postscriptName: string
      blob(): Promise<Blob>
    }[]
  >
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __OPEN_PENCIL_SET_TRANSPORT__?(factory: () => any): void
}
