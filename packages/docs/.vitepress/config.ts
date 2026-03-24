import { defineConfig, type DefaultTheme } from 'vitepress'

interface SidebarLabels {
  gettingAround: string
  creatingContent: string
  organizing: string
  advanced: string
  canvasNav: string
  selection: string
  shapes: string
  text: string
  pen: string
  layers: string
  contextMenu: string
  exporting: string
  autoLayout: string
  components: string
  variables: string
  guide: string
  gettingStarted: string
  features: string
  architecture: string
  techStack: string
  comparison: string
  figmaMatrix: string
}

interface ProgrammableLabels {
  overview: string
  cli: string
  inspecting: string
  exporting: string
  analyzing: string
  scripting: string
  jsxRenderer: string
  mcpServer: string
  aiChat: string
  collaboration: string
}

interface NavLabels {
  guide: string
  userGuide: string
  programmable: string
  sdk: string
  reference: string
  development: string
  openApp: string
}

const SDK_COMPONENT_PAGES = [
  { text: 'CanvasRoot', slug: 'canvas-root' },
  { text: 'CanvasSurface', slug: 'canvas-surface' },
  { text: 'LayerTreeRoot', slug: 'layer-tree-root' },
  { text: 'LayerTreeItem', slug: 'layer-tree-item' },
  { text: 'ToolbarRoot', slug: 'toolbar-root' },
  { text: 'ToolbarItem', slug: 'toolbar-item' },
  { text: 'PageListRoot', slug: 'page-list-root' },
  { text: 'PropertyListRoot', slug: 'property-list-root' },
  { text: 'PropertyListItem', slug: 'property-list-item' },
  { text: 'ColorPickerRoot', slug: 'color-picker-root' },
  { text: 'ColorInputRoot', slug: 'color-input-root' },
  { text: 'FillPickerRoot', slug: 'fill-picker-root' },
  { text: 'FontPickerRoot', slug: 'font-picker-root' },
  { text: 'GradientEditorRoot', slug: 'gradient-editor-root' },
  { text: 'GradientEditorBar', slug: 'gradient-editor-bar' },
  { text: 'GradientEditorStop', slug: 'gradient-editor-stop' },
  { text: 'ScrubInputRoot', slug: 'scrub-input-root' },
  { text: 'ScrubInputField', slug: 'scrub-input-field' },
  { text: 'ScrubInputDisplay', slug: 'scrub-input-display' },
  { text: 'LayoutControlsRoot', slug: 'layout-controls-root' },
  { text: 'AppearanceControlsRoot', slug: 'appearance-controls-root' },
  { text: 'PositionControlsRoot', slug: 'position-controls-root' },
  { text: 'TypographyControlsRoot', slug: 'typography-controls-root' },
] as const

const SDK_COMPOSABLE_PAGES = [
  { text: 'provideEditor', slug: 'provide-editor' },
  { text: 'useEditor', slug: 'use-editor' },
  { text: 'useCanvas', slug: 'use-canvas' },
  { text: 'useCanvasInput', slug: 'use-canvas-input' },
  { text: 'useTextEdit', slug: 'use-text-edit' },
  { text: 'useSelectionState', slug: 'use-selection-state' },
  { text: 'useSelectionCapabilities', slug: 'use-selection-capabilities' },
  { text: 'useEditorCommands', slug: 'use-editor-commands' },
  { text: 'useMenuModel', slug: 'use-menu-model' },
  { text: 'usePosition', slug: 'use-position' },
  { text: 'useLayout', slug: 'use-layout' },
  { text: 'useAppearance', slug: 'use-appearance' },
  { text: 'useTypography', slug: 'use-typography' },
  { text: 'useExport', slug: 'use-export' },
  { text: 'useFillControls', slug: 'use-fill-controls' },
  { text: 'useStrokeControls', slug: 'use-stroke-controls' },
  { text: 'useEffectsControls', slug: 'use-effects-controls' },
  { text: 'useVariablesEditor', slug: 'use-variables-editor' },
  { text: 'usePageList', slug: 'use-page-list' },
] as const

const SDK_ADVANCED_PAGES = [
  { text: 'useNodeProps', slug: 'use-node-props' },
  { text: 'useSceneComputed', slug: 'use-scene-computed' },
  { text: 'useFillVariableBinding', slug: 'use-fill-variable-binding' },
  { text: 'useFillPicker', slug: 'use-fill-picker' },
  { text: 'useGradientStops', slug: 'use-gradient-stops' },
  { text: 'useFontPicker', slug: 'use-font-picker' },
  { text: 'usePropScrub', slug: 'use-prop-scrub' },
  { text: 'useLayerDrag', slug: 'use-layer-drag' },
  { text: 'useInlineRename', slug: 'use-inline-rename' },
  { text: 'useToolbarState', slug: 'use-toolbar-state' },
  { text: 'useNodeFontStatus', slug: 'use-node-font-status' },
  { text: 'useCanvasDrop', slug: 'use-canvas-drop' },
  { text: 'extractImageFilesFromClipboard', slug: 'extract-image-files-from-clipboard' },
  { text: 'toolCursor', slug: 'tool-cursor' },
  { text: 'useCanvasContext', slug: 'use-canvas-context' },
  { text: 'useLayerTree', slug: 'use-layer-tree' },
  { text: 'useToolbar', slug: 'use-toolbar' },
  { text: 'usePropertyList', slug: 'use-property-list' },
  { text: 'useScrubInput', slug: 'use-scrub-input' },
] as const

const userGuideSidebar = (prefix: string, l: SidebarLabels): DefaultTheme.SidebarItem[] => [
  {
    text: l.gettingAround,
    items: [
      { text: l.canvasNav, link: `${prefix}/user-guide/canvas-navigation` },
      { text: l.selection, link: `${prefix}/user-guide/selection-and-manipulation` },
    ],
  },
  {
    text: l.creatingContent,
    items: [
      { text: l.shapes, link: `${prefix}/user-guide/drawing-shapes` },
      { text: l.text, link: `${prefix}/user-guide/text-editing` },
      { text: l.pen, link: `${prefix}/user-guide/pen-tool` },
    ],
  },
  {
    text: l.organizing,
    items: [
      { text: l.layers, link: `${prefix}/user-guide/layers-and-pages` },
      { text: l.exporting, link: `${prefix}/user-guide/exporting` },
    ],
  },
  {
    text: l.advanced,
    items: [
      { text: l.autoLayout, link: `${prefix}/user-guide/auto-layout` },
      { text: l.components, link: `${prefix}/user-guide/components` },
      { text: l.variables, link: `${prefix}/user-guide/variables` },
    ],
  },
]

const programmableSidebar = (
  prefix: string,
  p: ProgrammableLabels,
): DefaultTheme.SidebarItem[] => [
  {
    text: p.overview,
    link: `${prefix}/programmable/`,
  },
  {
    text: p.aiChat,
    link: `${prefix}/programmable/ai-chat`,
  },
  {
    text: p.collaboration,
    link: `${prefix}/programmable/collaboration`,
  },
  {
    text: p.jsxRenderer,
    link: `${prefix}/programmable/jsx-renderer`,
  },
  {
    text: p.cli,
    items: [
      { text: p.inspecting, link: `${prefix}/programmable/cli/inspecting` },
      { text: p.exporting, link: `${prefix}/programmable/cli/exporting` },
      { text: p.analyzing, link: `${prefix}/programmable/cli/analyzing` },
      { text: p.scripting, link: `${prefix}/programmable/cli/scripting` },
    ],
  },
  {
    text: p.mcpServer,
    link: `${prefix}/programmable/mcp-server`,
  },
]


const sdkSidebar = (prefix: string): DefaultTheme.SidebarItem[] => [
  {
    text: 'Vue SDK',
    items: [
      { text: 'Overview', link: `${prefix}/programmable/sdk/` },
      { text: 'Getting Started', link: `${prefix}/programmable/sdk/getting-started` },
      { text: 'Architecture', link: `${prefix}/programmable/sdk/architecture` },
      { text: 'Custom Shell', link: `${prefix}/programmable/sdk/guides/custom-editor-shell` },
      { text: 'Property Panels', link: `${prefix}/programmable/sdk/guides/property-panels` },
      { text: 'Navigation Panels', link: `${prefix}/programmable/sdk/guides/navigation-panels` },
      {
        text: 'API Reference',
        items: [
          { text: 'Overview', link: `${prefix}/programmable/sdk/api/` },
          {
            text: 'Components',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/components/` },
              ...SDK_COMPONENT_PAGES.map((page) => ({
                text: page.text,
                link: `${prefix}/programmable/sdk/api/components/${page.slug}`,
              })),
            ],
          },
          {
            text: 'Composables',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/composables/` },
              ...SDK_COMPOSABLE_PAGES.map((page) => ({
                text: page.text,
                link: `${prefix}/programmable/sdk/api/composables/${page.slug}`,
              })),
            ],
          },
          {
            text: 'Advanced',
            items: [
              { text: 'Overview', link: `${prefix}/programmable/sdk/api/advanced/` },
              ...SDK_ADVANCED_PAGES.map((page) => ({
                text: page.text,
                link: `${prefix}/programmable/sdk/api/advanced/${page.slug}`,
              })),
            ],
          },
        ],
      },
    ],
  },
]

const guideSidebar = (prefix: string, l: SidebarLabels): DefaultTheme.SidebarItem[] => [
  {
    text: l.guide,
    items: [
      { text: l.gettingStarted, link: `${prefix}/guide/getting-started` },
      { text: l.features, link: `${prefix}/guide/features` },
      { text: l.architecture, link: `${prefix}/guide/architecture` },
      { text: l.techStack, link: `${prefix}/guide/tech-stack` },
      { text: l.comparison, link: `${prefix}/guide/comparison` },
      { text: l.figmaMatrix, link: `${prefix}/guide/figma-comparison` },
    ],
  },
]

const referenceSidebar = (prefix: string, label: string): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Keyboard Shortcuts', link: `${prefix}/reference/keyboard-shortcuts` },
      { text: 'CLI', link: `${prefix}/reference/cli` },
      { text: 'Node Types', link: `${prefix}/reference/node-types` },
      { text: 'Scene Graph', link: `${prefix}/reference/scene-graph` },
      { text: 'File Format', link: `${prefix}/reference/file-format` },
    ],
  },
]

const developmentSidebar = (prefix: string, label: string): DefaultTheme.SidebarItem[] => [
  {
    text: label,
    items: [
      { text: 'Contributing', link: `${prefix}/development/contributing` },
      { text: 'Testing', link: `${prefix}/development/testing` },
      { text: 'OpenSpec', link: `${prefix}/development/openspec` },
      { text: 'Roadmap', link: `${prefix}/development/roadmap` },
    ],
  },
]

const EN_PROG: ProgrammableLabels = { overview: 'Overview', cli: 'CLI', inspecting: 'Inspecting Files', exporting: 'Exporting', analyzing: 'Analyzing Designs', scripting: 'Scripting', jsxRenderer: 'JSX Renderer', mcpServer: 'MCP Server', aiChat: 'AI Chat', collaboration: 'Collaboration' }
const DE_PROG: ProgrammableLabels = { overview: 'Überblick', cli: 'CLI', inspecting: 'Dateien inspizieren', exporting: 'Exportieren', analyzing: 'Designs analysieren', scripting: 'Skripte', jsxRenderer: 'JSX-Renderer', mcpServer: 'MCP-Server', aiChat: 'KI-Chat', collaboration: 'Zusammenarbeit' }
const IT_PROG: ProgrammableLabels = { overview: 'Panoramica', cli: 'CLI', inspecting: 'Ispezione file', exporting: 'Esportazione', analyzing: 'Analisi design', scripting: 'Scripting', jsxRenderer: 'Renderer JSX', mcpServer: 'Server MCP', aiChat: 'Chat IA', collaboration: 'Collaborazione' }
const FR_PROG: ProgrammableLabels = { overview: 'Vue d’ensemble', cli: 'CLI', inspecting: 'Inspecter les fichiers', exporting: 'Exporter', analyzing: 'Analyser les designs', scripting: 'Scripts', jsxRenderer: 'Moteur JSX', mcpServer: 'Serveur MCP', aiChat: 'Chat IA', collaboration: 'Collaboration' }
const ES_PROG: ProgrammableLabels = { overview: 'Resumen', cli: 'CLI', inspecting: 'Inspeccionar archivos', exporting: 'Exportar', analyzing: 'Analizar diseños', scripting: 'Scripts', jsxRenderer: 'Renderizador JSX', mcpServer: 'Servidor MCP', aiChat: 'Chat IA', collaboration: 'Colaboración' }
const PL_PROG: ProgrammableLabels = { overview: 'Przegląd', cli: 'CLI', inspecting: 'Inspekcja plików', exporting: 'Eksportowanie', analyzing: 'Analiza projektów', scripting: 'Skrypty', jsxRenderer: 'Renderer JSX', mcpServer: 'Serwer MCP', aiChat: 'Czat AI', collaboration: 'Współpraca' }
const RU_PROG: ProgrammableLabels = { overview: 'Обзор', cli: 'CLI', inspecting: 'Инспекция файлов', exporting: 'Экспорт', analyzing: 'Анализ дизайна', scripting: 'Скрипты', jsxRenderer: 'JSX-рендерер', mcpServer: 'MCP-сервер', aiChat: 'ИИ-чат', collaboration: 'Совместная работа' }

const localeThemeConfig = (
  prefix: string,
  nav: NavLabels,
  sidebar: SidebarLabels,
  prog: ProgrammableLabels,
): DefaultTheme.Config => ({
  nav: [
    { text: nav.guide, link: `${prefix}/guide/getting-started` },
    { text: nav.userGuide, link: `${prefix}/user-guide/` },
    { text: nav.programmable, link: `${prefix}/programmable/` },
    { text: nav.sdk, link: `${prefix}/programmable/sdk/` },
    { text: nav.reference, link: `${prefix}/reference/keyboard-shortcuts` },
    { text: nav.development, link: `${prefix}/development/contributing` },
    { text: nav.openApp, link: 'https://app.openpencil.dev' },
  ],
  sidebar: {
    [`${prefix}/user-guide/`]: userGuideSidebar(prefix, sidebar),
    [`${prefix}/programmable/sdk/`]: sdkSidebar(prefix),
    [`${prefix}/programmable/`]: programmableSidebar(prefix, prog),
    [`${prefix}/reference/`]: referenceSidebar(prefix, nav.reference),
    [`${prefix}/`]: [
      ...guideSidebar(prefix, sidebar),
      ...developmentSidebar(prefix, nav.development),
    ],
  },
})

const EN: SidebarLabels = { gettingAround: 'Getting Around', creatingContent: 'Creating Content', organizing: 'Organizing & Managing', advanced: 'Advanced Features', canvasNav: 'Canvas Navigation', selection: 'Selection & Manipulation', shapes: 'Drawing Shapes', text: 'Text Editing', pen: 'Pen Tool', layers: 'Layers & Pages', contextMenu: 'Context Menu', exporting: 'Exporting', autoLayout: 'Auto Layout', components: 'Components', variables: 'Variables', guide: 'Guide', gettingStarted: 'Getting Started', features: 'Features', architecture: 'Architecture', techStack: 'Tech Stack', comparison: 'Comparison', figmaMatrix: 'Figma Feature Matrix' }

const DE: SidebarLabels = { gettingAround: 'Erste Schritte', creatingContent: 'Inhalte erstellen', organizing: 'Organisieren', advanced: 'Erweitert', canvasNav: 'Canvas-Navigation', selection: 'Auswahl & Bearbeitung', shapes: 'Formen zeichnen', text: 'Textbearbeitung', pen: 'Stiftwerkzeug', layers: 'Ebenen & Seiten', contextMenu: 'Kontextmenü', exporting: 'Exportieren', autoLayout: 'Auto-Layout', components: 'Komponenten', variables: 'Variablen', guide: 'Anleitung', gettingStarted: 'Erste Schritte', features: 'Funktionen', architecture: 'Architektur', techStack: 'Tech-Stack', comparison: 'Vergleich', figmaMatrix: 'Figma-Funktionsmatrix' }

const IT: SidebarLabels = { gettingAround: 'Orientamento', creatingContent: 'Creazione contenuti', organizing: 'Organizzazione', advanced: 'Avanzate', canvasNav: 'Navigazione canvas', selection: 'Selezione e manipolazione', shapes: 'Disegno forme', text: 'Modifica testo', pen: 'Strumento penna', layers: 'Livelli e pagine', contextMenu: 'Menu contestuale', exporting: 'Esportazione', autoLayout: 'Auto-layout', components: 'Componenti', variables: 'Variabili', guide: 'Guida', gettingStarted: 'Per iniziare', features: 'Funzionalità', architecture: 'Architettura', techStack: 'Stack tecnologico', comparison: 'Confronto', figmaMatrix: 'Matrice funzionalità Figma' }

const FR: SidebarLabels = { gettingAround: 'Prise en main', creatingContent: 'Création de contenu', organizing: 'Organisation', advanced: 'Avancé', canvasNav: 'Navigation sur le canevas', selection: 'Sélection et manipulation', shapes: 'Dessiner des formes', text: 'Édition de texte', pen: 'Outil plume', layers: 'Calques et pages', contextMenu: 'Menu contextuel', exporting: 'Exportation', autoLayout: 'Mise en page auto', components: 'Composants', variables: 'Variables', guide: 'Guide', gettingStarted: 'Premiers pas', features: 'Fonctionnalités', architecture: 'Architecture', techStack: 'Stack technique', comparison: 'Comparaison', figmaMatrix: 'Matrice des fonctionnalités Figma' }

const ES: SidebarLabels = { gettingAround: 'Orientación', creatingContent: 'Crear contenido', organizing: 'Organizar', advanced: 'Avanzado', canvasNav: 'Navegación del lienzo', selection: 'Selección y manipulación', shapes: 'Dibujar formas', text: 'Edición de texto', pen: 'Herramienta pluma', layers: 'Capas y páginas', contextMenu: 'Menú contextual', exporting: 'Exportar', autoLayout: 'Auto-layout', components: 'Componentes', variables: 'Variables', guide: 'Guía', gettingStarted: 'Primeros pasos', features: 'Características', architecture: 'Arquitectura', techStack: 'Stack tecnológico', comparison: 'Comparación', figmaMatrix: 'Matriz de funcionalidades Figma' }

const PL: SidebarLabels = { gettingAround: 'Nawigacja', creatingContent: 'Tworzenie treści', organizing: 'Organizacja', advanced: 'Zaawansowane', canvasNav: 'Nawigacja po płótnie', selection: 'Zaznaczanie i edycja', shapes: 'Rysowanie kształtów', text: 'Edycja tekstu', pen: 'Narzędzie pióro', layers: 'Warstwy i strony', contextMenu: 'Menu kontekstowe', exporting: 'Eksportowanie', autoLayout: 'Auto-layout', components: 'Komponenty', variables: 'Zmienne', guide: 'Przewodnik', gettingStarted: 'Rozpoczęcie pracy', features: 'Funkcje', architecture: 'Architektura', techStack: 'Stack technologiczny', comparison: 'Porównanie', figmaMatrix: 'Matryca funkcji Figma' }

const RU: SidebarLabels = { gettingAround: 'Навигация', creatingContent: 'Создание контента', organizing: 'Организация', advanced: 'Продвинутые функции', canvasNav: 'Навигация по холсту', selection: 'Выделение и редактирование', shapes: 'Рисование фигур', text: 'Редактирование текста', pen: 'Инструмент «Перо»', layers: 'Слои и страницы', contextMenu: 'Контекстное меню', exporting: 'Экспорт', autoLayout: 'Авто-раскладка', components: 'Компоненты', variables: 'Переменные', guide: 'Руководство', gettingStarted: 'Начало работы', features: 'Возможности', architecture: 'Архитектура', techStack: 'Технологии', comparison: 'Сравнение', figmaMatrix: 'Матрица функций Figma' }

const BASE = 'https://openpencil.dev'

const LOCALE_PREFIXES = ['de', 'fr', 'es', 'it', 'pl', 'ru'] as const

const LOCALES: Record<string, { hreflang: string; ogLocale: string; prefix: string }> = {
  en: { hreflang: 'en', ogLocale: 'en_US', prefix: '' },
  de: { hreflang: 'de', ogLocale: 'de_DE', prefix: '/de' },
  fr: { hreflang: 'fr', ogLocale: 'fr_FR', prefix: '/fr' },
  es: { hreflang: 'es', ogLocale: 'es_ES', prefix: '/es' },
  it: { hreflang: 'it', ogLocale: 'it_IT', prefix: '/it' },
  pl: { hreflang: 'pl', ogLocale: 'pl_PL', prefix: '/pl' },
  ru: { hreflang: 'ru', ogLocale: 'ru_RU', prefix: '/ru' },
}

export default defineConfig({
  title: 'OpenPencil',
  description: 'Open-source, AI-native design editor. Figma alternative built from scratch with full .fig file compatibility.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  sitemap: {
    hostname: BASE,
    transformItems(items) {
      return items.map((item) => {
        const localeKey = LOCALE_PREFIXES.find((p) => item.url.startsWith(p + '/')) ?? 'en'
        const slug = item.url
          .replace(new RegExp(`^(${LOCALE_PREFIXES.join('|')})/`), '')
          .replace(/\/$/, '')

        return {
          ...item,
          links: Object.entries(LOCALES).map(([, loc]) => {
            const url = slug ? `${BASE}${loc.prefix}/${slug}` : `${BASE}${loc.prefix || '/'}`
            return { lang: loc.hreflang, url }
          }),
        }
      })
    },
  },

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'OpenPencil' }],
    ['meta', { property: 'og:image', content: `${BASE}/screenshot.png` }],
    ['meta', { property: 'og:image:width', content: '2784' }],
    ['meta', { property: 'og:image:height', content: '1824' }],
    ['meta', { property: 'og:image:alt', content: 'OpenPencil — AI-Native Design Editor' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:site', content: '@openpencildev' }],
    ['meta', { name: 'twitter:image', content: `${BASE}/screenshot.png` }],
  ],

  transformPageData(pageData) {
    const rel = pageData.relativePath

    const localeKey = (LOCALE_PREFIXES.find((p) => rel.startsWith(p + '/')) as string) ?? 'en'
    const locale = LOCALES[localeKey]

    const slug = rel
      .replace(new RegExp(`^(${LOCALE_PREFIXES.join('|')})/`), '')
      .replace(/\.md$/, '')
      .replace(/\/index$/, '')
      .replace(/^index$/, '')

    const pageUrl = slug ? `${BASE}${locale.prefix}/${slug}` : `${BASE}${locale.prefix || ''}`
    const enSlug = slug ? `${BASE}/${slug}` : BASE

    pageData.frontmatter.head ??= []
    const h = pageData.frontmatter.head as [string, Record<string, string>][]

    h.push(['link', { rel: 'canonical', href: pageUrl }])
    h.push(['meta', { property: 'og:url', content: pageUrl }])
    h.push(['meta', { property: 'og:locale', content: locale.ogLocale }])

    for (const [key, loc] of Object.entries(LOCALES)) {
      if (key !== localeKey) {
        h.push(['meta', { property: 'og:locale:alternate', content: loc.ogLocale }])
      }
    }

    for (const [, loc] of Object.entries(LOCALES)) {
      const altUrl = slug ? `${BASE}${loc.prefix}/${slug}` : `${BASE}${loc.prefix || ''}`
      h.push(['link', { rel: 'alternate', hreflang: loc.hreflang, href: altUrl }])
    }
    h.push(['link', { rel: 'alternate', hreflang: 'x-default', href: enSlug }])

    if (pageData.title) {
      const ogTitle = `${pageData.title} — OpenPencil`
      h.push(['meta', { property: 'og:title', content: ogTitle }])
      h.push(['meta', { name: 'twitter:title', content: ogTitle }])
    }

    if (pageData.description) {
      h.push(['meta', { property: 'og:description', content: pageData.description }])
      h.push(['meta', { name: 'twitter:description', content: pageData.description }])
      h.push(['meta', { name: 'description', content: pageData.description }])
    }
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
    },
    de: {
      label: 'Deutsch',
      lang: 'de',
      description: 'Open-Source, KI-nativer Design-Editor. Figma-Alternative.',
      themeConfig: localeThemeConfig('/de', { guide: 'Guide', userGuide: 'Benutzerhandbuch', programmable: 'Automation', sdk: 'SDK', reference: 'Referenz', development: 'Entwicklung', openApp: 'App öffnen' }, DE, DE_PROG),
    },
    it: {
      label: 'Italiano',
      lang: 'it',
      description: 'Editor di design open-source, IA-nativo. Alternativa a Figma.',
      themeConfig: localeThemeConfig('/it', { guide: 'Guida', userGuide: 'Guida utente', programmable: 'Automation', sdk: 'SDK', reference: 'Riferimento', development: 'Sviluppo', openApp: 'Apri app' }, IT, IT_PROG),
    },
    fr: {
      label: 'Français',
      lang: 'fr',
      description: 'Éditeur de design open-source, IA-natif. Alternative à Figma.',
      themeConfig: localeThemeConfig('/fr', { guide: 'Guide', userGuide: 'Guide utilisateur', programmable: 'Automation', sdk: 'SDK', reference: 'Référence', development: 'Développement', openApp: "Ouvrir l'app" }, FR, FR_PROG),
    },
    es: {
      label: 'Español',
      lang: 'es',
      description: 'Editor de diseño open-source, IA-nativo. Alternativa a Figma.',
      themeConfig: localeThemeConfig('/es', { guide: 'Guía', userGuide: 'Guía del usuario', programmable: 'Automation', sdk: 'SDK', reference: 'Referencia', development: 'Desarrollo', openApp: 'Abrir app' }, ES, ES_PROG),
    },
    pl: {
      label: 'Polski',
      lang: 'pl',
      description: "Open-source'owy edytor graficzny z natywnym AI. Alternatywa dla Figmy.",
      themeConfig: localeThemeConfig('/pl', { guide: 'Przewodnik', userGuide: 'Podręcznik', programmable: 'Automation', sdk: 'SDK', reference: 'Referencja', development: 'Rozwój', openApp: 'Otwórz app' }, PL, PL_PROG),
    },
    ru: {
      label: 'Русский',
      lang: 'ru',
      description: 'Дизайн-редактор с открытым исходным кодом. Альтернатива Figma с встроенным ИИ.',
      themeConfig: localeThemeConfig('/ru', { guide: 'Руководство', userGuide: 'Руководство', programmable: 'Automation', sdk: 'SDK', reference: 'Справочник', development: 'Разработка', openApp: 'Открыть приложение' }, RU, RU_PROG),
    },
  },

  themeConfig: {
    search: { provider: 'local' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'User Guide', link: '/user-guide/' },
      { text: 'Automation', link: '/programmable/' },
      { text: 'SDK', link: '/programmable/sdk/' },
      { text: 'Reference', link: '/reference/keyboard-shortcuts' },
      { text: 'Development', link: '/development/contributing' },
      { text: 'Open App', link: 'https://app.openpencil.dev' },
    ],

    sidebar: {
      '/user-guide/': userGuideSidebar('', EN),
      '/programmable/sdk/': sdkSidebar(''),
      '/programmable/': programmableSidebar('', EN_PROG),
      '/reference/': referenceSidebar('', 'Reference'),
      '/': [
        ...guideSidebar('', EN),
        {
          text: 'Development',
          items: [
            { text: 'Contributing', link: '/development/contributing' },
            { text: 'Testing', link: '/development/testing' },
            { text: 'OpenSpec Workflow', link: '/development/openspec' },
            { text: 'Roadmap', link: '/development/roadmap' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/open-pencil/open-pencil' }],

    editLink: {
      pattern: 'https://github.com/open-pencil/open-pencil/edit/main/packages/docs/:path',
    },

    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
