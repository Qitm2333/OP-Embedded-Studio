export const bundledThemesInfo: never[] = []
export const bundledLanguagesInfo: never[] = []
export function createHighlighter() {
  return { getLoadedLanguages: () => [], getLoadedThemes: () => [], codeToTokens: () => ({ tokens: [] }), loadLanguage: async () => {}, loadTheme: async () => {}, dispose: () => {} }
}
