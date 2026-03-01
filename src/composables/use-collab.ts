import { ref, onUnmounted, computed } from 'vue'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

import type { EditorStore } from '@/stores/editor'
import type { SceneNode } from '@/engine/scene-graph'
import type { Color } from '@/types'

const MSG_SYNC = 0
const MSG_AWARENESS = 1

const COLLAB_URL = import.meta.env.VITE_COLLAB_URL || 'wss://collab.openpencil.dev'

const PEER_COLORS: Color[] = [
  { r: 0.96, g: 0.26, b: 0.21, a: 1 },
  { r: 0.13, g: 0.59, b: 0.95, a: 1 },
  { r: 0.30, g: 0.69, b: 0.31, a: 1 },
  { r: 1.00, g: 0.76, b: 0.03, a: 1 },
  { r: 0.61, g: 0.15, b: 0.69, a: 1 },
  { r: 1.00, g: 0.34, b: 0.13, a: 1 },
  { r: 0.00, g: 0.74, b: 0.83, a: 1 },
  { r: 0.91, g: 0.12, b: 0.39, a: 1 },
]

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  cursor?: { x: number; y: number; pageId: string }
  selection?: string[]
}

export interface CollabState {
  connected: boolean
  roomId: string | null
  peers: RemotePeer[]
  localName: string
  localColor: Color
}

export function useCollab(store: EditorStore) {
  const state = ref<CollabState>({
    connected: false,
    roomId: null,
    peers: [],
    localName: localStorage.getItem('op-collab-name') || '',
    localColor: PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)],
  })

  let ws: WebSocket | null = null
  let ydoc: Y.Doc | null = null
  let awareness: awarenessProtocol.Awareness | null = null
  let ynodes: Y.Map<Y.Map<unknown>> | null = null
  let ymeta: Y.Map<unknown> | null = null
  let suppressGraphEvents = false
  let suppressYjsEvents = false

  const remotePeers = computed(() => state.value.peers)

  function connect(roomId: string) {
    if (ws) disconnect()

    state.value.roomId = roomId
    ydoc = new Y.Doc()
    awareness = new awarenessProtocol.Awareness(ydoc)
    ynodes = ydoc.getMap('nodes')
    ymeta = ydoc.getMap('meta')

    // Listen for awareness changes → update peers list
    awareness.on('change', () => {
      updatePeersList()
    })

    // Listen for remote Yjs changes → apply to SceneGraph
    ynodes.observeDeep((events) => {
      if (suppressYjsEvents) return
      suppressGraphEvents = true
      try {
        applyYjsToGraph(events)
      } finally {
        suppressGraphEvents = false
      }
      store.requestRender()
    })

    // WebSocket connection
    const url = `${COLLAB_URL}/room/${roomId}`
    ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      state.value.connected = true
      broadcastAwareness()
      if (ymeta) ymeta.set('roomId', roomId)
    }

    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return
      handleMessage(new Uint8Array(event.data))
    }

    ws.onclose = () => {
      state.value.connected = false
      // TODO: reconnect logic
    }

    ws.onerror = () => {
      state.value.connected = false
    }

    // Sync local SceneGraph → Yjs on graph mutations
    const origUpdateNode = store.graph.updateNode.bind(store.graph)
    store.graph.updateNode = (id: string, changes: Partial<SceneNode>) => {
      origUpdateNode(id, changes)
      if (!suppressGraphEvents && ydoc && ynodes) {
        syncNodeToYjs(id)
      }
    }
  }

  function disconnect() {
    if (ws) {
      ws.close()
      ws = null
    }
    if (awareness) {
      awareness.destroy()
      awareness = null
    }
    if (ydoc) {
      ydoc.destroy()
      ydoc = null
    }
    ynodes = null
    ymeta = null
    state.value.connected = false
    state.value.roomId = null
    state.value.peers = []
  }

  function handleMessage(data: Uint8Array) {
    if (!ydoc || !awareness) return

    const decoder = decoding.createDecoder(data)
    const msgType = decoding.readVarUint(decoder)

    switch (msgType) {
      case MSG_SYNC: {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MSG_SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, ydoc, null)

        if (encoding.length(encoder) > 1) {
          sendBinary(encoding.toUint8Array(encoder))
        }
        break
      }

      case MSG_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder)
        awarenessProtocol.applyAwarenessUpdate(awareness, update, null)
        break
      }
    }
  }

  function sendBinary(data: Uint8Array) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  }

  // Sync doc updates to server
  function setupDocSync() {
    if (!ydoc) return
    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, MSG_SYNC)
      syncProtocol.writeUpdate(encoder, update)
      sendBinary(encoding.toUint8Array(encoder))
    })
  }

  function syncNodeToYjs(nodeId: string) {
    if (!ydoc || !ynodes) return
    const node = store.graph.getNode(nodeId)
    if (!node) return

    suppressYjsEvents = true
    ydoc.transact(() => {
      let ynode = ynodes!.get(nodeId)
      if (!ynode) {
        ynode = new Y.Map()
        ynodes!.set(nodeId, ynode)
      }
      // Sync all scalar properties
      for (const [key, value] of Object.entries(node)) {
        if (key === 'childIds') {
          ynode.set(key, JSON.stringify(value))
        } else if (typeof value === 'object' && value !== null) {
          ynode.set(key, JSON.stringify(value))
        } else {
          ynode.set(key, value)
        }
      }
    })
    suppressYjsEvents = false
  }

  function syncAllNodesToYjs() {
    if (!ydoc || !ynodes) return
    suppressYjsEvents = true
    ydoc.transact(() => {
      for (const node of store.graph.getAllNodes()) {
        let ynode = ynodes!.get(node.id)
        if (!ynode) {
          ynode = new Y.Map()
          ynodes!.set(node.id, ynode)
        }
        for (const [key, value] of Object.entries(node)) {
          if (key === 'childIds') {
            ynode.set(key, JSON.stringify(value))
          } else if (typeof value === 'object' && value !== null) {
            ynode.set(key, JSON.stringify(value))
          } else {
            ynode.set(key, value)
          }
        }
      }
    })
    suppressYjsEvents = false
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    for (const event of events) {
      if (event.target === ynodes) {
        // Top-level additions/deletions of nodes
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'add') {
            const ynode = ynodes!.get(key)
            if (ynode) applyYnodeToGraph(key, ynode)
          } else if (change.action === 'delete') {
            store.graph.deleteNode(key)
          }
        }
      } else if (event.target.parent === ynodes) {
        // Property changes within a node's Y.Map
        const nodeId = findNodeIdForYMap(event.target as Y.Map<unknown>)
        if (nodeId) {
          const ynode = ynodes!.get(nodeId)
          if (ynode) applyYnodeToGraph(nodeId, ynode)
        }
      }
    }
  }

  function findNodeIdForYMap(ymap: Y.Map<unknown>): string | null {
    if (!ynodes) return null
    for (const [key, value] of ynodes.entries()) {
      if (value === ymap) return key
    }
    return null
  }

  function applyYnodeToGraph(nodeId: string, ynode: Y.Map<unknown>) {
    const existing = store.graph.getNode(nodeId)
    const props: Record<string, unknown> = {}

    for (const [key, value] of ynode.entries()) {
      if (key === 'childIds' || key === 'fills' || key === 'strokes' || key === 'effects' ||
          key === 'vectorNetwork' || key === 'boundVariables' || key === 'styleRuns') {
        try {
          props[key] = typeof value === 'string' ? JSON.parse(value) : value
        } catch {
          props[key] = value
        }
      } else {
        props[key] = value
      }
    }

    if (existing) {
      store.graph.updateNode(nodeId, props as Partial<SceneNode>)
    } else {
      // New node from remote — create it
      const parentId = props.parentId as string
      if (parentId && store.graph.getNode(parentId)) {
        const type = props.type as SceneNode['type']
        const node = store.graph.createNode(type, parentId, props as Partial<SceneNode>)
        // Override the auto-generated id with the actual id
        store.graph.nodes.delete(node.id)
        node.id = nodeId
        store.graph.nodes.set(nodeId, node)
      }
    }
  }

  // Awareness: broadcast local cursor/selection
  function broadcastAwareness() {
    if (!awareness) return
    awareness.setLocalStateField('user', {
      name: state.value.localName,
      color: state.value.localColor,
    })
  }

  function updateCursor(x: number, y: number, pageId: string) {
    if (!awareness) return
    awareness.setLocalStateField('cursor', { x, y, pageId })
  }

  function updateSelection(ids: string[]) {
    if (!awareness) return
    awareness.setLocalStateField('selection', ids)
  }

  function updatePeersList() {
    if (!awareness) return
    const states = awareness.getStates()
    const peers: RemotePeer[] = []
    const localClientId = awareness.clientID
    const currentPageId = store.state.currentPageId

    states.forEach((peerState, clientId) => {
      if (clientId === localClientId) return
      const user = peerState.user as { name?: string; color?: Color } | undefined
      if (!user) return
      peers.push({
        clientId,
        name: user.name || 'Anonymous',
        color: user.color || PEER_COLORS[clientId % PEER_COLORS.length],
        cursor: peerState.cursor as RemotePeer['cursor'],
        selection: peerState.selection as string[],
      })
    })

    state.value.peers = peers

    // Update store's remoteCursors for renderer
    store.state.remoteCursors = peers
      .filter(p => p.cursor && p.cursor.pageId === currentPageId)
      .map(p => ({
        name: p.name,
        color: p.color,
        x: p.cursor!.x,
        y: p.cursor!.y,
        selection: p.selection,
      }))
    store.requestRender()
  }

  function setLocalName(name: string) {
    state.value.localName = name
    localStorage.setItem('op-collab-name', name)
    broadcastAwareness()
  }

  function generateRoomId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars[Math.floor(Math.random() * chars.length)]
    }
    return result
  }

  function shareCurrentDoc(): string {
    const roomId = generateRoomId()
    connect(roomId)
    setupDocSync()
    syncAllNodesToYjs()
    return roomId
  }

  function joinRoom(roomId: string) {
    connect(roomId)
    setupDocSync()
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    state,
    remotePeers,
    connect: joinRoom,
    disconnect,
    shareCurrentDoc,
    updateCursor,
    updateSelection,
    setLocalName,
  }
}
