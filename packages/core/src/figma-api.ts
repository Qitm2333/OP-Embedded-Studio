import type { Rect } from './types'
import type {
  SceneNode,
  NodeType,
  Fill,
  Stroke,
  Effect,
  LayoutMode,
} from './scene-graph'
import { SceneGraph } from './scene-graph'

const MIXED = Symbol('mixed')

type FigmaFontName = { family: string; style: string }

function weightToStyleName(weight: number, italic: boolean): string {
  const names: Record<number, string> = {
    100: 'Thin',
    200: 'Extra Light',
    300: 'Light',
    400: 'Regular',
    500: 'Medium',
    600: 'Semi Bold',
    700: 'Bold',
    800: 'Extra Bold',
    900: 'Black',
  }
  const base = names[weight] ?? 'Regular'
  return italic ? `${base} Italic` : base
}

function styleNameToWeight(style: string): { weight: number; italic: boolean } {
  const lower = style.toLowerCase()
  const italic = lower.includes('italic')
  const clean = lower.replace(/italic/i, '').trim()
  const map: Record<string, number> = {
    thin: 100,
    'extra light': 200,
    'ultra light': 200,
    light: 300,
    regular: 400,
    '': 400,
    medium: 500,
    'semi bold': 600,
    'demi bold': 600,
    bold: 700,
    'extra bold': 800,
    'ultra bold': 800,
    black: 900,
    heavy: 900,
  }
  return { weight: map[clean] ?? 400, italic }
}

class FigmaNodeProxy {
  readonly _id: string
  readonly _graph: SceneGraph
  readonly _api: FigmaAPI

  constructor(id: string, graph: SceneGraph, api: FigmaAPI) {
    this._id = id
    this._graph = graph
    this._api = api
  }

  private _raw(): SceneNode {
    const n = this._graph.getNode(this._id)
    if (!n) throw new Error(`Node ${this._id} has been removed`)
    return n
  }

  get id(): string {
    return this._id
  }

  get type(): NodeType {
    return this._raw().type
  }

  get name(): string {
    return this._raw().name
  }

  set name(v: string) {
    this._graph.updateNode(this._id, { name: v })
  }

  get removed(): boolean {
    return !this._graph.getNode(this._id)
  }

  // --- Geometry ---

  get x(): number {
    return this._raw().x
  }

  set x(v: number) {
    this._graph.updateNode(this._id, { x: v })
  }

  get y(): number {
    return this._raw().y
  }

  set y(v: number) {
    this._graph.updateNode(this._id, { y: v })
  }

  get width(): number {
    return this._raw().width
  }

  get height(): number {
    return this._raw().height
  }

  get rotation(): number {
    return this._raw().rotation
  }

  set rotation(v: number) {
    this._graph.updateNode(this._id, { rotation: v })
  }

  resize(width: number, height: number): void {
    this._graph.updateNode(this._id, { width, height })
  }

  resizeWithoutConstraints(width: number, height: number): void {
    this.resize(width, height)
  }

  get absoluteTransform(): [[number, number, number], [number, number, number]] {
    const pos = this._graph.getAbsolutePosition(this._id)
    return [
      [1, 0, pos.x],
      [0, 1, pos.y],
    ]
  }

  get absoluteBoundingBox(): Rect {
    return this._graph.getAbsoluteBounds(this._id)
  }

  get absoluteRenderBounds(): Rect {
    return this.absoluteBoundingBox
  }

  // --- Visual ---

  get fills(): Fill[] {
    return this._raw().fills
  }

  set fills(v: Fill[]) {
    this._graph.updateNode(this._id, { fills: v })
  }

  get strokes(): Stroke[] {
    return this._raw().strokes
  }

  set strokes(v: Stroke[]) {
    this._graph.updateNode(this._id, { strokes: v })
  }

  get effects(): Effect[] {
    return this._raw().effects
  }

  set effects(v: Effect[]) {
    this._graph.updateNode(this._id, { effects: v })
  }

  get opacity(): number {
    return this._raw().opacity
  }

  set opacity(v: number) {
    this._graph.updateNode(this._id, { opacity: v })
  }

  get visible(): boolean {
    return this._raw().visible
  }

  set visible(v: boolean) {
    this._graph.updateNode(this._id, { visible: v })
  }

  get locked(): boolean {
    return this._raw().locked
  }

  set locked(v: boolean) {
    this._graph.updateNode(this._id, { locked: v })
  }

  get blendMode(): string {
    return this._raw().blendMode
  }

  set blendMode(v: string) {
    this._graph.updateNode(this._id, { blendMode: v as SceneNode['blendMode'] })
  }

  get clipsContent(): boolean {
    return this._raw().clipsContent
  }

  set clipsContent(v: boolean) {
    this._graph.updateNode(this._id, { clipsContent: v })
  }

  // --- Corner Radius ---

  get cornerRadius(): number | typeof MIXED {
    const n = this._raw()
    if (n.independentCorners) return MIXED
    return n.cornerRadius
  }

  set cornerRadius(v: number | typeof MIXED) {
    if (v === MIXED) return
    this._graph.updateNode(this._id, {
      cornerRadius: v as number,
      topLeftRadius: v as number,
      topRightRadius: v as number,
      bottomRightRadius: v as number,
      bottomLeftRadius: v as number,
      independentCorners: false,
    })
  }

  get topLeftRadius(): number {
    return this._raw().topLeftRadius
  }

  set topLeftRadius(v: number) {
    this._graph.updateNode(this._id, { topLeftRadius: v, independentCorners: true })
  }

  get topRightRadius(): number {
    return this._raw().topRightRadius
  }

  set topRightRadius(v: number) {
    this._graph.updateNode(this._id, { topRightRadius: v, independentCorners: true })
  }

  get bottomLeftRadius(): number {
    return this._raw().bottomLeftRadius
  }

  set bottomLeftRadius(v: number) {
    this._graph.updateNode(this._id, { bottomLeftRadius: v, independentCorners: true })
  }

  get bottomRightRadius(): number {
    return this._raw().bottomRightRadius
  }

  set bottomRightRadius(v: number) {
    this._graph.updateNode(this._id, { bottomRightRadius: v, independentCorners: true })
  }

  get cornerSmoothing(): number {
    return this._raw().cornerSmoothing
  }

  set cornerSmoothing(v: number) {
    this._graph.updateNode(this._id, { cornerSmoothing: v })
  }

  // --- Stroke details ---

  get strokeWeight(): number {
    const s = this._raw().strokes
    return s.length > 0 ? s[0].weight : 0
  }

  set strokeWeight(v: number) {
    const n = this._raw()
    if (n.strokes.length > 0) {
      const strokes = structuredClone(n.strokes)
      strokes[0].weight = v
      this._graph.updateNode(this._id, { strokes })
    }
  }

  get strokeAlign(): string {
    const s = this._raw().strokes
    return s.length > 0 ? s[0].align : 'INSIDE'
  }

  set strokeAlign(v: string) {
    const n = this._raw()
    if (n.strokes.length > 0) {
      const strokes = structuredClone(n.strokes)
      strokes[0].align = v as Stroke['align']
      this._graph.updateNode(this._id, { strokes })
    }
  }

  get dashPattern(): number[] {
    return this._raw().dashPattern
  }

  set dashPattern(v: number[]) {
    this._graph.updateNode(this._id, { dashPattern: v })
  }

  // --- Text ---

  get characters(): string {
    return this._raw().text
  }

  set characters(v: string) {
    this._graph.updateNode(this._id, { text: v })
  }

  get fontSize(): number {
    return this._raw().fontSize
  }

  set fontSize(v: number) {
    this._graph.updateNode(this._id, { fontSize: v })
  }

  get fontName(): FigmaFontName {
    const n = this._raw()
    return { family: n.fontFamily, style: weightToStyleName(n.fontWeight, n.italic) }
  }

  set fontName(v: FigmaFontName) {
    const { weight, italic } = styleNameToWeight(v.style)
    this._graph.updateNode(this._id, { fontFamily: v.family, fontWeight: weight, italic })
  }

  get fontWeight(): number {
    return this._raw().fontWeight
  }

  set fontWeight(v: number) {
    this._graph.updateNode(this._id, { fontWeight: v })
  }

  get textAlignHorizontal(): string {
    return this._raw().textAlignHorizontal
  }

  set textAlignHorizontal(v: string) {
    this._graph.updateNode(this._id, { textAlignHorizontal: v as SceneNode['textAlignHorizontal'] })
  }

  get textAlignVertical(): string {
    return this._raw().textAlignVertical
  }

  set textAlignVertical(v: string) {
    this._graph.updateNode(this._id, { textAlignVertical: v as SceneNode['textAlignVertical'] })
  }

  get textAutoResize(): string {
    return this._raw().textAutoResize
  }

  set textAutoResize(v: string) {
    this._graph.updateNode(this._id, { textAutoResize: v as SceneNode['textAutoResize'] })
  }

  get letterSpacing(): number {
    return this._raw().letterSpacing
  }

  set letterSpacing(v: number) {
    this._graph.updateNode(this._id, { letterSpacing: v })
  }

  get lineHeight(): number | null {
    return this._raw().lineHeight
  }

  set lineHeight(v: number | null) {
    this._graph.updateNode(this._id, { lineHeight: v })
  }

  get textCase(): string {
    return this._raw().textCase
  }

  set textCase(v: string) {
    this._graph.updateNode(this._id, { textCase: v as SceneNode['textCase'] })
  }

  get textDecoration(): string {
    return this._raw().textDecoration
  }

  set textDecoration(v: string) {
    this._graph.updateNode(this._id, { textDecoration: v as SceneNode['textDecoration'] })
  }

  get maxLines(): number | null {
    return this._raw().maxLines
  }

  set maxLines(v: number | null) {
    this._graph.updateNode(this._id, { maxLines: v })
  }

  // --- Auto-layout ---

  get layoutMode(): LayoutMode {
    return this._raw().layoutMode
  }

  set layoutMode(v: LayoutMode) {
    this._graph.updateNode(this._id, { layoutMode: v })
  }

  get primaryAxisAlignItems(): string {
    return this._raw().primaryAxisAlign
  }

  set primaryAxisAlignItems(v: string) {
    this._graph.updateNode(this._id, { primaryAxisAlign: v as SceneNode['primaryAxisAlign'] })
  }

  get counterAxisAlignItems(): string {
    return this._raw().counterAxisAlign
  }

  set counterAxisAlignItems(v: string) {
    this._graph.updateNode(this._id, { counterAxisAlign: v as SceneNode['counterAxisAlign'] })
  }

  get itemSpacing(): number {
    return this._raw().itemSpacing
  }

  set itemSpacing(v: number) {
    this._graph.updateNode(this._id, { itemSpacing: v })
  }

  get counterAxisSpacing(): number {
    return this._raw().counterAxisSpacing
  }

  set counterAxisSpacing(v: number) {
    this._graph.updateNode(this._id, { counterAxisSpacing: v })
  }

  get paddingTop(): number {
    return this._raw().paddingTop
  }

  set paddingTop(v: number) {
    this._graph.updateNode(this._id, { paddingTop: v })
  }

  get paddingRight(): number {
    return this._raw().paddingRight
  }

  set paddingRight(v: number) {
    this._graph.updateNode(this._id, { paddingRight: v })
  }

  get paddingBottom(): number {
    return this._raw().paddingBottom
  }

  set paddingBottom(v: number) {
    this._graph.updateNode(this._id, { paddingBottom: v })
  }

  get paddingLeft(): number {
    return this._raw().paddingLeft
  }

  set paddingLeft(v: number) {
    this._graph.updateNode(this._id, { paddingLeft: v })
  }

  get layoutWrap(): string {
    return this._raw().layoutWrap
  }

  set layoutWrap(v: string) {
    this._graph.updateNode(this._id, { layoutWrap: v as SceneNode['layoutWrap'] })
  }

  // --- Layout child props ---

  get layoutPositioning(): string {
    return this._raw().layoutPositioning
  }

  set layoutPositioning(v: string) {
    this._graph.updateNode(this._id, { layoutPositioning: v as SceneNode['layoutPositioning'] })
  }

  get layoutGrow(): number {
    return this._raw().layoutGrow
  }

  set layoutGrow(v: number) {
    this._graph.updateNode(this._id, { layoutGrow: v })
  }

  get layoutSizingHorizontal(): string {
    const n = this._raw()
    if (n.layoutMode !== 'NONE') return n.primaryAxisSizing
    const parent = n.parentId ? this._graph.getNode(n.parentId) : undefined
    if (!parent || parent.layoutMode === 'NONE') return 'FIXED'
    return parent.layoutMode === 'HORIZONTAL' ? n.primaryAxisSizing : n.counterAxisSizing
  }

  set layoutSizingHorizontal(v: string) {
    const n = this._raw()
    const parent = n.parentId ? this._graph.getNode(n.parentId) : undefined
    if (parent && parent.layoutMode === 'VERTICAL') {
      this._graph.updateNode(this._id, { counterAxisSizing: v as SceneNode['counterAxisSizing'] })
    } else {
      this._graph.updateNode(this._id, { primaryAxisSizing: v as SceneNode['primaryAxisSizing'] })
    }
  }

  get layoutSizingVertical(): string {
    const n = this._raw()
    if (n.layoutMode !== 'NONE') return n.counterAxisSizing
    const parent = n.parentId ? this._graph.getNode(n.parentId) : undefined
    if (!parent || parent.layoutMode === 'NONE') return 'FIXED'
    return parent.layoutMode === 'VERTICAL' ? n.primaryAxisSizing : n.counterAxisSizing
  }

  set layoutSizingVertical(v: string) {
    const n = this._raw()
    const parent = n.parentId ? this._graph.getNode(n.parentId) : undefined
    if (parent && parent.layoutMode === 'HORIZONTAL') {
      this._graph.updateNode(this._id, { counterAxisSizing: v as SceneNode['counterAxisSizing'] })
    } else {
      this._graph.updateNode(this._id, { primaryAxisSizing: v as SceneNode['primaryAxisSizing'] })
    }
  }

  // --- Constraints ---

  get constraints(): { horizontal: string; vertical: string } {
    const n = this._raw()
    return { horizontal: n.horizontalConstraint, vertical: n.verticalConstraint }
  }

  set constraints(v: { horizontal: string; vertical: string }) {
    this._graph.updateNode(this._id, {
      horizontalConstraint: v.horizontal as SceneNode['horizontalConstraint'],
      verticalConstraint: v.vertical as SceneNode['verticalConstraint'],
    })
  }

  // --- Components ---

  get mainComponent(): FigmaNodeProxy | null {
    const n = this._raw()
    if (!n.componentId) return null
    const comp = this._graph.getNode(n.componentId)
    if (!comp) return null
    return this._api.wrapNode(comp.id)
  }

  createInstance(): FigmaNodeProxy {
    const n = this._raw()
    if (n.type !== 'COMPONENT') throw new Error('createInstance() can only be called on components')
    const pageId = this._api.currentPageId
    const inst = this._graph.createInstance(n.id, pageId)
    if (!inst) throw new Error('Failed to create instance')
    return this._api.wrapNode(inst.id)
  }

  // --- Tree ---

  get parent(): FigmaNodeProxy | null {
    const n = this._raw()
    if (!n.parentId) return null
    return this._api.wrapNode(n.parentId)
  }

  get children(): FigmaNodeProxy[] {
    return this._graph
      .getChildren(this._id)
      .map((c) => this._api.wrapNode(c.id))
  }

  appendChild(child: FigmaNodeProxy): void {
    this._graph.reparentNode(child._id, this._id)
  }

  insertChild(index: number, child: FigmaNodeProxy): void {
    this._graph.reparentNode(child._id, this._id)
    this._graph.reorderChild(child._id, this._id, index)
  }

  remove(): void {
    this._graph.deleteNode(this._id)
  }

  findAll(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    const results: FigmaNodeProxy[] = []
    const walk = (id: string) => {
      for (const child of this._graph.getChildren(id)) {
        const proxy = this._api.wrapNode(child.id)
        if (!callback || callback(proxy)) results.push(proxy)
        walk(child.id)
      }
    }
    walk(this._id)
    return results
  }

  findOne(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    const walk = (id: string): FigmaNodeProxy | null => {
      for (const child of this._graph.getChildren(id)) {
        const proxy = this._api.wrapNode(child.id)
        if (callback(proxy)) return proxy
        const found = walk(child.id)
        if (found) return found
      }
      return null
    }
    return walk(this._id)
  }

  findChild(callback: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy | null {
    for (const child of this._graph.getChildren(this._id)) {
      const proxy = this._api.wrapNode(child.id)
      if (callback(proxy)) return proxy
    }
    return null
  }

  findChildren(callback?: (node: FigmaNodeProxy) => boolean): FigmaNodeProxy[] {
    return this._graph
      .getChildren(this._id)
      .map((c) => this._api.wrapNode(c.id))
      .filter((proxy) => !callback || callback(proxy))
  }

  // --- Serialization ---

  toJSON(): Record<string, unknown> {
    const n = this._raw()
    const obj: Record<string, unknown> = {
      id: n.id,
      type: n.type,
      name: n.name,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
    }
    if (n.fills.length > 0) obj.fills = n.fills
    if (n.strokes.length > 0) obj.strokes = n.strokes
    if (n.effects.length > 0) obj.effects = n.effects
    if (n.opacity !== 1) obj.opacity = n.opacity
    if (n.cornerRadius > 0) obj.cornerRadius = n.cornerRadius
    if (!n.visible) obj.visible = false
    if (n.text) obj.characters = n.text
    if (n.layoutMode !== 'NONE') {
      obj.layoutMode = n.layoutMode
      obj.itemSpacing = n.itemSpacing
    }
    const children = this._graph.getChildren(this._id)
    if (children.length > 0) {
      obj.children = children.map((c) => this._api.wrapNode(c.id).toJSON())
    }
    return obj
  }

  toString(): string {
    const n = this._raw()
    return `[${n.type} "${n.name}" ${n.id}]`
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return this.toString()
  }
}

export class FigmaAPI {
  readonly graph: SceneGraph
  private _currentPageId: string
  private _selection: FigmaNodeProxy[] = []
  private _nodeCache = new Map<string, FigmaNodeProxy>()

  readonly mixed = MIXED

  constructor(graph: SceneGraph) {
    this.graph = graph
    const pages = graph.getPages()
    this._currentPageId = pages[0]?.id ?? graph.rootId
  }

  get currentPageId(): string {
    return this._currentPageId
  }

  wrapNode(id: string): FigmaNodeProxy {
    let proxy = this._nodeCache.get(id)
    if (!proxy) {
      proxy = new FigmaNodeProxy(id, this.graph, this)
      this._nodeCache.set(id, proxy)
    }
    return proxy
  }

  get root(): FigmaNodeProxy {
    return this.wrapNode(this.graph.rootId)
  }

  get currentPage(): FigmaNodeProxy & { selection: FigmaNodeProxy[] } {
    const page = this.wrapNode(this._currentPageId)
    const self = this
    return Object.defineProperties(page, {
      selection: {
        get() {
          return self._selection
        },
        set(nodes: FigmaNodeProxy[]) {
          self._selection = nodes
        },
        enumerable: true,
        configurable: true,
      },
    }) as FigmaNodeProxy & { selection: FigmaNodeProxy[] }
  }

  set currentPage(page: FigmaNodeProxy) {
    this._currentPageId = page._id
  }

  getNodeById(id: string): FigmaNodeProxy | null {
    const node = this.graph.getNode(id)
    return node ? this.wrapNode(id) : null
  }

  // --- Node Creation ---

  private _createNode(type: NodeType): FigmaNodeProxy {
    const node = this.graph.createNode(type, this._currentPageId)
    return this.wrapNode(node.id)
  }

  createFrame(): FigmaNodeProxy {
    return this._createNode('FRAME')
  }

  createRectangle(): FigmaNodeProxy {
    return this._createNode('RECTANGLE')
  }

  createEllipse(): FigmaNodeProxy {
    return this._createNode('ELLIPSE')
  }

  createText(): FigmaNodeProxy {
    return this._createNode('TEXT')
  }

  createLine(): FigmaNodeProxy {
    return this._createNode('LINE')
  }

  createPolygon(): FigmaNodeProxy {
    return this._createNode('POLYGON')
  }

  createStar(): FigmaNodeProxy {
    return this._createNode('STAR')
  }

  createVector(): FigmaNodeProxy {
    return this._createNode('VECTOR')
  }

  createComponent(): FigmaNodeProxy {
    return this._createNode('COMPONENT')
  }

  createSection(): FigmaNodeProxy {
    return this._createNode('SECTION')
  }

  createPage(): FigmaNodeProxy {
    const page = this.graph.addPage('Page')
    return this.wrapNode(page.id)
  }

  // --- Grouping ---

  group(nodes: FigmaNodeProxy[], parent: FigmaNodeProxy): FigmaNodeProxy {
    const groupNode = this.graph.createNode('GROUP', parent._id)
    for (const n of nodes) {
      this.graph.reparentNode(n._id, groupNode.id)
    }
    return this.wrapNode(groupNode.id)
  }

  ungroup(node: FigmaNodeProxy): void {
    const raw = this.graph.getNode(node._id)
    if (!raw || raw.type !== 'GROUP') return
    const parentId = raw.parentId ?? this._currentPageId
    for (const childId of [...raw.childIds]) {
      this.graph.reparentNode(childId, parentId)
    }
    this.graph.deleteNode(node._id)
  }

  // --- Stubs ---

  async loadFontAsync(_fontName: FigmaFontName): Promise<void> {
    // No-op: we don't gate text editing on font loading
  }

  notify(message: string): { cancel: () => void } {
    if (typeof console !== 'undefined') console.log(`[figma.notify] ${message}`)
    return { cancel() {} }
  }

  commitUndo(): void {}
  triggerUndo(): void {}
}

export { FigmaNodeProxy }
export type { FigmaFontName }
