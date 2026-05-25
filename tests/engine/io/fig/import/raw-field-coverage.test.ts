import { describe, expect, test } from 'bun:test'

import { FIGMA_RAW_NODE_FIELD_KEYS } from '#core/kiwi/fig/node-change/convert'

const RAW_FIELD_COVERAGE = {
  rendered: [
    'backgroundColor',
    'borderBottomWeight',
    'borderLeftWeight',
    'borderRightWeight',
    'borderStrokeWeightsIndependent',
    'borderTopWeight',
    'derivedTextData',
    'effects',
    'fillGeometry',
    'fillPaints',
    'fontName',
    'fontSize',
    'fontVariantCommonLigatures',
    'fontVariantContextualLigatures',
    'fontVariations',
    'leadingTrim',
    'letterSpacing',
    'lineHeight',
    'maxLines',
    'miterLimit',
    'semanticItalic',
    'semanticWeight',
    'strokeGeometry',
    'strokeJoin',
    'strokePaints',
    'strokeWeight',
    'textAutoResize',
    'textData',
    'textDecorationStyle',
    'textPathStart',
    'textTracking',
    'vectorData'
  ],
  uiEditable: [
    'componentPropDefs',
    'fontSize',
    'letterSpacing',
    'lineHeight',
    'strokeJoin',
    'strokeWeight',
    'textAutoResize'
  ],
  toolEditable: [
    'componentPropDefs',
    'effects',
    'fillPaints',
    'fontSize',
    'letterSpacing',
    'lineHeight',
    'strokeJoin',
    'strokePaints',
    'strokeWeight',
    'textAutoResize',
    'vectorData'
  ],
  roundTripOnly: [
    'annotationCategories',
    'brushType',
    'codeSyntax',
    'componentPropRefs',
    'description',
    'detachedSymbolId',
    'documentColorProfile',
    'editInfo',
    'fontVersion',
    'gridChildHorizontalAlign',
    'gridChildVerticalAlign',
    'gridColumnAnchor',
    'gridColumns',
    'gridColumnsSizing',
    'gridRowAnchor',
    'gridRows',
    'gridRowsSizing',
    'guides',
    'handoffStatusMap',
    'isPageDivider',
    'isSoftDeleted',
    'isStateGroup',
    'key',
    'lockMode',
    'maxSize',
    'minSize',
    'pageType',
    'parameterConsumptionMap',
    'scatterStrokeSettings',
    'sectionStatusInfo',
    'slideThemeMap',
    'sortPosition',
    'sourceLibraryKey',
    'stateGroupPropertyValueOrders',
    'styleIdForEffect',
    'styleIdForFill',
    'styleIdForGrid',
    'styleIdForStrokeFill',
    'styleIdForText',
    'textExplicitLayoutVersion',
    'textUserLayoutVersion',
    'targetAspectRatio',
    'userFacingVersion',
    'variableConsumptionMap',
    'variableModeBySetMap',
    'variantPropSpecs',
    'vectorOperationVersion',
    'version'
  ],
  unsupportedUnknown: []
} as const satisfies Record<string, readonly string[]>

describe('Figma raw field coverage', () => {
  test('classifies every preserved raw node field', () => {
    const knownKeys = new Set(FIGMA_RAW_NODE_FIELD_KEYS)
    const classifiedKeys = new Set(Object.values(RAW_FIELD_COVERAGE).flat())

    expect(new Set(FIGMA_RAW_NODE_FIELD_KEYS).size).toBe(FIGMA_RAW_NODE_FIELD_KEYS.length)
    expect([...classifiedKeys].sort()).toEqual([...knownKeys].sort())
  })

  test('keeps unsupported raw field bucket explicit', () => {
    expect(RAW_FIELD_COVERAGE.unsupportedUnknown).toEqual([])
  })
})
