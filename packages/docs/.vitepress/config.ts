import { defineConfig } from 'vitepress'

const userGuideSidebar = (prefix = '') => [
  {
    text: 'Getting Around',
    items: [
      { text: 'Canvas Navigation', link: `${prefix}/user-guide/canvas-navigation` },
      { text: 'Selection & Manipulation', link: `${prefix}/user-guide/selection-and-manipulation` },
    ],
  },
  {
    text: 'Creating Content',
    items: [
      { text: 'Drawing Shapes', link: `${prefix}/user-guide/drawing-shapes` },
      { text: 'Text Editing', link: `${prefix}/user-guide/text-editing` },
      { text: 'Pen Tool', link: `${prefix}/user-guide/pen-tool` },
    ],
  },
  {
    text: 'Organizing & Managing',
    items: [
      { text: 'Layers & Pages', link: `${prefix}/user-guide/layers-and-pages` },
      { text: 'Context Menu', link: `${prefix}/user-guide/context-menu` },
      { text: 'Exporting', link: `${prefix}/user-guide/exporting` },
    ],
  },
  {
    text: 'Advanced Features',
    items: [
      { text: 'Auto Layout', link: `${prefix}/user-guide/auto-layout` },
      { text: 'Components', link: `${prefix}/user-guide/components` },
      { text: 'Variables', link: `${prefix}/user-guide/variables` },
    ],
  },
]

const guideSidebar = (prefix = '') => [
  {
    text: 'Guide',
    items: [
      { text: 'Getting Started', link: `${prefix}/guide/getting-started` },
      { text: 'Features', link: `${prefix}/guide/features` },
      { text: 'Architecture', link: `${prefix}/guide/architecture` },
      { text: 'Tech Stack', link: `${prefix}/guide/tech-stack` },
      { text: 'Comparison', link: `${prefix}/guide/comparison` },
      { text: 'Figma Feature Matrix', link: `${prefix}/guide/figma-comparison` },
    ],
  },
]

const localeSidebar = (lang: string, labels: { gettingAround: string; creatingContent: string; organizing: string; advanced: string; canvasNav: string; selection: string; shapes: string; text: string; pen: string; layers: string; contextMenu: string; exporting: string; autoLayout: string; components: string; variables: string; guide: string; gettingStarted: string; features: string; architecture: string; techStack: string; comparison: string; figmaMatrix: string }) => ({
  [`/${lang}/user-guide/`]: [
    { text: labels.gettingAround, items: [
      { text: labels.canvasNav, link: `/${lang}/user-guide/canvas-navigation` },
      { text: labels.selection, link: `/${lang}/user-guide/selection-and-manipulation` },
    ]},
    { text: labels.creatingContent, items: [
      { text: labels.shapes, link: `/${lang}/user-guide/drawing-shapes` },
      { text: labels.text, link: `/${lang}/user-guide/text-editing` },
      { text: labels.pen, link: `/${lang}/user-guide/pen-tool` },
    ]},
    { text: labels.organizing, items: [
      { text: labels.layers, link: `/${lang}/user-guide/layers-and-pages` },
      { text: labels.contextMenu, link: `/${lang}/user-guide/context-menu` },
      { text: labels.exporting, link: `/${lang}/user-guide/exporting` },
    ]},
    { text: labels.advanced, items: [
      { text: labels.autoLayout, link: `/${lang}/user-guide/auto-layout` },
      { text: labels.components, link: `/${lang}/user-guide/components` },
      { text: labels.variables, link: `/${lang}/user-guide/variables` },
    ]},
  ],
  [`/${lang}/`]: [
    { text: labels.guide, items: [
      { text: labels.gettingStarted, link: `/${lang}/guide/getting-started` },
      { text: labels.features, link: `/${lang}/guide/features` },
      { text: labels.architecture, link: `/${lang}/guide/architecture` },
      { text: labels.techStack, link: `/${lang}/guide/tech-stack` },
      { text: labels.comparison, link: `/${lang}/guide/comparison` },
      { text: labels.figmaMatrix, link: `/${lang}/guide/figma-comparison` },
    ]},
  ],
})

export default defineConfig({
  title: 'OpenPencil',
  description: 'Open-source, AI-native design editor. Figma alternative built from scratch with full .fig file compatibility.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/favicon.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'OpenPencil' }],
    ['meta', { property: 'og:description', content: 'Open-source, AI-native design editor' }],
  ],

  locales: {
    root: { label: 'English', lang: 'en' },
    de: { label: 'Deutsch', lang: 'de' },
    it: { label: 'Italiano', lang: 'it' },
    fr: { label: 'Français', lang: 'fr' },
    es: { label: 'Español', lang: 'es' },
    pl: { label: 'Polski', lang: 'pl' },
  },

  themeConfig: {
    search: { provider: 'local' },

    nav: [
      { text: 'User Guide', link: '/user-guide/' },
      { text: 'Reference', link: '/reference/keyboard-shortcuts' },
      { text: 'Development', link: '/development/contributing' },
      { text: 'Open App', link: 'https://app.openpencil.dev' },
    ],

    sidebar: {
      '/user-guide/': userGuideSidebar(),
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Keyboard Shortcuts', link: '/reference/keyboard-shortcuts' },
            { text: 'Node Types', link: '/reference/node-types' },
            { text: 'MCP Tools', link: '/reference/mcp-tools' },
            { text: 'Scene Graph', link: '/reference/scene-graph' },
            { text: 'File Format', link: '/reference/file-format' },
            { text: 'Eval Command', link: '/eval-command' },
          ],
        },
      ],
      '/': [
        ...guideSidebar(),
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
      ...localeSidebar('de', { gettingAround: 'Erste Schritte', creatingContent: 'Inhalte erstellen', organizing: 'Organisieren', advanced: 'Erweitert', canvasNav: 'Canvas-Navigation', selection: 'Auswahl & Bearbeitung', shapes: 'Formen zeichnen', text: 'Textbearbeitung', pen: 'Stiftwerkzeug', layers: 'Ebenen & Seiten', contextMenu: 'Kontextmenü', exporting: 'Exportieren', autoLayout: 'Auto-Layout', components: 'Komponenten', variables: 'Variablen', guide: 'Anleitung', gettingStarted: 'Erste Schritte', features: 'Funktionen', architecture: 'Architektur', techStack: 'Tech-Stack', comparison: 'Vergleich', figmaMatrix: 'Figma-Funktionsmatrix' }),
      ...localeSidebar('it', { gettingAround: 'Orientamento', creatingContent: 'Creazione contenuti', organizing: 'Organizzazione', advanced: 'Avanzate', canvasNav: 'Navigazione canvas', selection: 'Selezione e manipolazione', shapes: 'Disegno forme', text: 'Modifica testo', pen: 'Strumento penna', layers: 'Livelli e pagine', contextMenu: 'Menu contestuale', exporting: 'Esportazione', autoLayout: 'Auto-layout', components: 'Componenti', variables: 'Variabili', guide: 'Guida', gettingStarted: 'Per iniziare', features: 'Funzionalità', architecture: 'Architettura', techStack: 'Stack tecnologico', comparison: 'Confronto', figmaMatrix: 'Matrice funzionalità Figma' }),
      ...localeSidebar('fr', { gettingAround: 'Prise en main', creatingContent: 'Création de contenu', organizing: 'Organisation', advanced: 'Avancé', canvasNav: 'Navigation sur le canevas', selection: 'Sélection et manipulation', shapes: 'Dessiner des formes', text: 'Édition de texte', pen: 'Outil plume', layers: 'Calques et pages', contextMenu: 'Menu contextuel', exporting: 'Exportation', autoLayout: 'Mise en page auto', components: 'Composants', variables: 'Variables', guide: 'Guide', gettingStarted: 'Premiers pas', features: 'Fonctionnalités', architecture: 'Architecture', techStack: 'Stack technique', comparison: 'Comparaison', figmaMatrix: 'Matrice des fonctionnalités Figma' }),
      ...localeSidebar('es', { gettingAround: 'Orientación', creatingContent: 'Crear contenido', organizing: 'Organizar', advanced: 'Avanzado', canvasNav: 'Navegación del lienzo', selection: 'Selección y manipulación', shapes: 'Dibujar formas', text: 'Edición de texto', pen: 'Herramienta pluma', layers: 'Capas y páginas', contextMenu: 'Menú contextual', exporting: 'Exportar', autoLayout: 'Auto-layout', components: 'Componentes', variables: 'Variables', guide: 'Guía', gettingStarted: 'Primeros pasos', features: 'Características', architecture: 'Arquitectura', techStack: 'Stack tecnológico', comparison: 'Comparación', figmaMatrix: 'Matriz de funcionalidades Figma' }),
      ...localeSidebar('pl', { gettingAround: 'Nawigacja', creatingContent: 'Tworzenie treści', organizing: 'Organizacja', advanced: 'Zaawansowane', canvasNav: 'Nawigacja po płótnie', selection: 'Zaznaczanie i edycja', shapes: 'Rysowanie kształtów', text: 'Edycja tekstu', pen: 'Narzędzie pióro', layers: 'Warstwy i strony', contextMenu: 'Menu kontekstowe', exporting: 'Eksportowanie', autoLayout: 'Auto-layout', components: 'Komponenty', variables: 'Zmienne', guide: 'Przewodnik', gettingStarted: 'Rozpoczęcie pracy', features: 'Funkcje', architecture: 'Architektura', techStack: 'Stack technologiczny', comparison: 'Porównanie', figmaMatrix: 'Matryca funkcji Figma' }),
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/open-pencil/open-pencil' },
    ],

    editLink: {
      pattern: 'https://github.com/open-pencil/open-pencil/edit/main/packages/docs/:path',
    },

    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
