export interface FigDocumentSource {
  readonly bytes?: Uint8Array
  readonly fileName?: string
}

export interface FigDocument<Graph = unknown> {
  readonly graph: Graph
  readonly source?: FigDocumentSource
}

export interface ReadFigOptions {
  readonly preserveRawMetadata?: boolean
}

export interface WriteFigOptions {
  readonly source?: FigDocumentSource
}

export const FIG_PACKAGE_STATUS = 'scaffold' as const

export function assertFigPackageReady(): void {
  throw new Error(
    '@open-pencil/fig is scaffolded for package-boundary work; use @open-pencil/core for .fig read/write APIs for now.'
  )
}
