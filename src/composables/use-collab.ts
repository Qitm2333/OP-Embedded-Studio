import { ref, onUnmounted, computed } from 'vue'
import * as awarenessProtocol from 'y-protocols/awareness'
import { IndexeddbPersistence } from 'y-indexeddb'
import { joinRoom as joinTrysteroRoom } from 'trystero'
import type { Room } from 'trystero'
import * as Y from 'yjs'

import type { SceneNode } from '@/engine/scene-graph'
import type { EditorStore } from '@/stores/editor'
import type { Color } from '@/types'

const TRYSTERO_APP_ID = 'openpencil'

const PEER_COLORS: Color[] = [
  { r: 0.96, g: 0.26, b: 0.21, a: 1 },
  { r: 0.13, g: 0.59, b: 0.95, a: 1 },
  { r: 0.3, g: 0.69, b: 0.31, a: 1 },
  { r: 1.0, g: 0.76, b: 0.03, a: 1 },
  { r: 0.61, g: 0.15, b: 0.69, a: 1 },
  { r: 1.0, g: 0.34, b: 0.13, a: 1 },
  { r: 0.0, g: 0.74, b: 0.83, a: 1 },
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

  let ydoc: Y.Doc | null = null
  let awareness: awarenessProtocol.Awareness | null = null
  let ynodes: Y.Map<Y.Map<unknown>> | null = null
  let room: Room | null = null
  let persistence: IndexeddbPersistence | null = null
  let suppressGraphEvents = false
  let suppressYjsEvents = false
  let sendYjsUpdate: ((data: Uint8Array, peerId?: string) => void) | null = null
  let sendAwareness: ((data: Uint8Array, peerId?: string) => void) | null = null
  let sendSyncStep1: ((data: Uint8Array, peerId?: string) => void) | null = null

  const remotePeers = computed(() => state.value.peers)

  function connect(roomId: string) {
    if (room) disconnect()

    state.value.roomId = roomId
    ydoc = new Y.Doc()
    awareness = new awarenessProtocol.Awareness(ydoc)
    ynodes = ydoc.getMap('nodes')

    persistence = new IndexeddbPersistence(`op-room-${roomId}`, ydoc)

    awareness.on('change', () => {
      updatePeersList()
    })

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

    room = joinTrysteroRoom({ appId: TRYSTERO_APP_ID }, roomId)

    const [sendUpdate, getUpdate] = room.makeAction<Uint8Array>('yjs-update')
    const [sendAw, getAw] = room.makeAction<Uint8Array>('awareness')
    const [sendSync, getSync] = room.makeAction<Uint8Array>('sync-step1')
    const [sendSyncReply, getSyncReply] = room.makeAction<Uint8Array>('sync-reply')

    sendYjsUpdate = (data, peerId) =>
      peerId ? sendUpdate(data, peerId) : sendUpdate(data)
    sendAwareness = (data, peerId) =>
      peerId ? sendAw(data, peerId) : sendAw(data)
    sendSyncStep1 = (data, peerId) =>
      peerId ? sendSync(data, peerId) : sendSync(data)

    getUpdate((data) => {
      if (!ydoc) return
      Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
    })

    getAw((data) => {
      if (!awareness) return
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(data), null)
    })

    getSync((data, peerId) => {
      if (!ydoc) return
      const sv = new Uint8Array(data)
      const update = Y.encodeStateAsUpdate(ydoc, sv)
      sendSyncReply(update, peerId)
    })

    getSyncReply((data) => {
      if (!ydoc) return
      Y.applyUpdate(ydoc, new Uint8Array(data), 'remote')
    })

    ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      sendYjsUpdate?.(update)
    })

    awareness.on('update', ({ added, updated, removed }: {
      added: number[]
      updated: number[]
      removed: number[]
    }) => {
      const changedClients = [...added, ...updated, ...removed]
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness!, changedClients)
      sendAwareness?.(encodedUpdate)
    })

    room.onPeerJoin((peerId) => {
      state.value.connected = true
      const sv = Y.encodeStateVector(ydoc!)
      sendSyncStep1?.(sv, peerId)

      if (awareness) {
        const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(
          awareness,
          [awareness.clientID]
        )
        sendAwareness?.(encodedUpdate, peerId)
      }
    })

    room.onPeerLeave(() => {
      updatePeersList()
    })

    state.value.connected = true
    broadcastAwareness()

    const origUpdateNode = store.graph.updateNode.bind(store.graph)
    store.graph.updateNode = (id: string, changes: Partial<SceneNode>) => {
      origUpdateNode(id, changes)
      if (!suppressGraphEvents && ydoc && ynodes) {
        syncNodeToYjs(id)
      }
    }
  }

  function disconnect() {
    room?.leave()
    room = null
    sendYjsUpdate = null
    sendAwareness = null
    sendSyncStep1 = null

    if (awareness) {
      awareness.destroy()
      awareness = null
    }
    if (persistence) {
      persistence.destroy()
      persistence = null
    }
    if (ydoc) {
      ydoc.destroy()
      ydoc = null
    }
    ynodes = null
    state.value.connected = false
    state.value.roomId = null
    state.value.peers = []
    store.state.remoteCursors = []
    store.requestRender()
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
      syncNodePropsToYMap(node, ynode)
    })
    suppressYjsEvents = false
  }

  function syncNodePropsToYMap(node: SceneNode, ynode: Y.Map<unknown>) {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'object' && value !== null) {
        ynode.set(key, JSON.stringify(value))
      } else {
        ynode.set(key, value)
      }
    }
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
        syncNodePropsToYMap(node, ynode)
      }
    })
    suppressYjsEvents = false
  }

  function applyYjsToGraph(events: Y.YEvent<Y.Map<unknown>>[]) {
    for (const event of events) {
      if (event.target === ynodes) {
        for (const [key, change] of event.changes.keys) {
          if (change.action === 'add') {
            const ynode = ynodes!.get(key)
            if (ynode) applyYnodeToGraph(key, ynode)
          } else if (change.action === 'delete') {
            store.graph.deleteNode(key)
          }
        }
      } else if (event.target.parent === ynodes) {
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
    const JSON_FIELDS = new Set([
      'childIds', 'fills', 'strokes', 'effects',
      'vectorNetwork', 'boundVariables', 'styleRuns',
    ])
    const existing = store.graph.getNode(nodeId)
    const props: Record<string, unknown> = {}

    for (const [key, value] of ynode.entries()) {
      if (JSON_FIELDS.has(key)) {
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
      const parentId = props.parentId as string
      if (parentId && store.graph.getNode(parentId)) {
        const type = props.type as SceneNode['type']
        const node = store.graph.createNode(type, parentId, props as Partial<SceneNode>)
        store.graph.nodes.delete(node.id)
        node.id = nodeId
        store.graph.nodes.set(nodeId, node)
      }
    }
  }

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
    store.state.remoteCursors = peers
      .filter((p) => p.cursor && p.cursor.pageId === currentPageId)
      .map((p) => ({
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
    syncAllNodesToYjs()
    return roomId
  }

  function joinRoom(roomId: string) {
    connect(roomId)
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
