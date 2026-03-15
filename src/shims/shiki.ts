export const bundledThemesInfo: never[] = []
export const bundledLanguagesInfo: never[] = []
export async function createHighlighter() {
  return {
    getLoadedLanguages: () => [] as string[],
    getLoadedThemes: () => [] as string[],
    codeToTokens: () => ({ tokens: [], themeName: '', fg: '', bg: '' }),
    loadLanguage: async () => {},
    loadTheme: async () => {},
    dispose: () => {}
  }
}
