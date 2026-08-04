import { computed, ref } from 'vue'

import {
  DEVICE_PROTOTYPE_EVENTS,
  type DevicePrototypeDefinition,
  type DevicePrototypeEventId,
  type DevicePrototypeFrameCandidate,
  type DevicePrototypeInteraction,
  type DevicePrototypeInteractionOption,
  type DevicePrototypeState
} from '../model/types'

export interface CreateDevicePrototypeInteractionInput {
  name: string
  definition: DevicePrototypeDefinition
}

const interactions = ref<DevicePrototypeInteraction[]>([])
const selectedInteractionId = ref('')
const selectedStateId = ref('')

function createId(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`
}

function createInteraction(name: string): DevicePrototypeInteraction {
  return {
    id: createId('interaction'),
    name,
    initialStateId: '',
    states: [],
    transitions: []
  }
}

function validateDefinition(definition: DevicePrototypeDefinition): void {
  if (definition.states.length < 2) throw new Error('交互至少需要两个 Frame')
  if (definition.states.length > 10) throw new Error('交互最多支持 10 个 Frame')

  const stateIds = new Set(definition.states.map((state) => state.id))
  if (stateIds.size !== definition.states.length) throw new Error('交互中包含重复的 Frame')
  if (!stateIds.has(definition.initialStateId)) throw new Error('交互缺少有效的初始 Frame')

  const supportedEvents = new Set<string>(DEVICE_PROTOTYPE_EVENTS.map((event) => event.id))
  const transitionKeys = new Set<string>()
  for (const transition of definition.transitions) {
    if (!stateIds.has(transition.fromStateId) || !stateIds.has(transition.toStateId)) {
      throw new Error('交互跳转引用了不存在的 Frame')
    }
    if (!supportedEvents.has(transition.event)) throw new Error('交互包含不支持的设备事件')
    const key = `${transition.fromStateId}:${transition.event}`
    if (transitionKeys.has(key)) throw new Error('同一 Frame 的同一事件只能设置一个目标')
    transitionKeys.add(key)
  }
}

export function useDevicePrototype() {
  if (interactions.value.length === 0) {
    const interaction = createInteraction('默认交互')
    interactions.value = [interaction]
    selectedInteractionId.value = interaction.id
  }

  const selectedInteraction = computed(
    () =>
      interactions.value.find((interaction) => interaction.id === selectedInteractionId.value) ??
      null
  )
  const states = computed(() => selectedInteraction.value?.states ?? [])
  const transitions = computed(() => selectedInteraction.value?.transitions ?? [])
  const initialStateId = computed(() => selectedInteraction.value?.initialStateId ?? '')
  const selectedState = computed(
    () => states.value.find((state) => state.id === selectedStateId.value) ?? null
  )
  const interactionOptions = computed<DevicePrototypeInteractionOption[]>(() =>
    interactions.value.map((interaction) => {
      const firstState = interaction.states.at(0)
      const initialState = interaction.states.find(
        (state) => state.id === interaction.initialStateId
      )
      const valid = interaction.states.length > 0 && Boolean(initialState)
      let reason = ''
      if (interaction.states.length === 0) reason = '尚未添加界面状态'
      else if (!initialState) reason = '未设置有效的初始状态'

      return {
        id: interaction.id,
        name: interaction.name,
        stateCount: interaction.states.length,
        initialStateName: initialState?.name ?? '',
        width: firstState?.width ?? 0,
        height: firstState?.height ?? 0,
        valid,
        reason: reason || undefined
      }
    })
  )

  function updateSelectedInteraction(
    updater: (interaction: DevicePrototypeInteraction) => DevicePrototypeInteraction
  ) {
    interactions.value = interactions.value.map((interaction) =>
      interaction.id === selectedInteractionId.value ? updater(interaction) : interaction
    )
  }

  function addInteraction() {
    const interaction = createInteraction(`交互 ${interactions.value.length + 1}`)
    interactions.value = [...interactions.value, interaction]
    selectedInteractionId.value = interaction.id
    selectedStateId.value = ''
  }

  function createInteractionFromDefinition(
    input: CreateDevicePrototypeInteractionInput
  ): DevicePrototypeInteraction {
    const name = input.name.trim()
    if (!name) throw new Error('交互名称不能为空')
    validateDefinition(input.definition)

    const interaction: DevicePrototypeInteraction = {
      id: createId('interaction'),
      name,
      initialStateId: input.definition.initialStateId,
      states: input.definition.states.map((state) => ({ ...state })),
      transitions: input.definition.transitions.map((transition) => ({ ...transition }))
    }
    interactions.value = [...interactions.value, interaction]
    selectedInteractionId.value = interaction.id
    selectedStateId.value = interaction.initialStateId
    return interaction
  }

  function removeInteraction(interactionId: string) {
    if (interactions.value.length <= 1) return
    interactions.value = interactions.value.filter(
      (interaction) => interaction.id !== interactionId
    )
    if (selectedInteractionId.value === interactionId) {
      selectedInteractionId.value = interactions.value[0]?.id ?? ''
      selectedStateId.value = interactions.value[0]?.states[0]?.id ?? ''
    }
  }

  function selectInteraction(interactionId: string) {
    const interaction = interactions.value.find((item) => item.id === interactionId)
    if (!interaction) return
    selectedInteractionId.value = interactionId
    selectedStateId.value = interaction.states[0]?.id ?? ''
  }

  function renameInteraction(name: string) {
    const normalizedName = name.trim()
    if (!normalizedName) return
    updateSelectedInteraction((interaction) => ({ ...interaction, name: normalizedName }))
  }

  function addFrame(candidate: DevicePrototypeFrameCandidate) {
    if (!candidate.available || !selectedInteraction.value) return
    const existing = states.value.find((state) => state.frameId === candidate.id)
    if (existing) {
      selectedStateId.value = existing.id
      return
    }

    const state: DevicePrototypeState = {
      id: candidate.id,
      frameId: candidate.id,
      name: candidate.name,
      width: candidate.width,
      height: candidate.height
    }
    updateSelectedInteraction((interaction) => ({
      ...interaction,
      states: [...interaction.states, state],
      initialStateId: interaction.initialStateId || state.id
    }))
    selectedStateId.value = state.id
  }

  function removeState(stateId: string) {
    updateSelectedInteraction((interaction) => {
      const nextStates = interaction.states.filter((state) => state.id !== stateId)
      return {
        ...interaction,
        states: nextStates,
        transitions: interaction.transitions.filter(
          (transition) => transition.fromStateId !== stateId && transition.toStateId !== stateId
        ),
        initialStateId:
          interaction.initialStateId === stateId
            ? (nextStates[0]?.id ?? '')
            : interaction.initialStateId
      }
    })
    if (selectedStateId.value === stateId) selectedStateId.value = states.value[0]?.id ?? ''
  }

  function setInitialState(stateId: string) {
    if (!states.value.some((state) => state.id === stateId)) return
    updateSelectedInteraction((interaction) => ({ ...interaction, initialStateId: stateId }))
  }

  function selectState(stateId: string) {
    if (states.value.some((state) => state.id === stateId)) selectedStateId.value = stateId
  }

  function transitionTarget(fromStateId: string, event: DevicePrototypeEventId): string {
    return (
      transitions.value.find(
        (transition) => transition.fromStateId === fromStateId && transition.event === event
      )?.toStateId ?? ''
    )
  }

  function setTransition(fromStateId: string, event: DevicePrototypeEventId, toStateId: string) {
    updateSelectedInteraction((interaction) => {
      const nextTransitions = interaction.transitions.filter(
        (transition) => !(transition.fromStateId === fromStateId && transition.event === event)
      )
      if (toStateId && interaction.states.some((state) => state.id === toStateId)) {
        nextTransitions.push({ fromStateId, event, toStateId })
      }
      return { ...interaction, transitions: nextTransitions }
    })
  }

  function definition(
    interactionId = selectedInteractionId.value
  ): DevicePrototypeDefinition | null {
    const interaction = interactions.value.find((item) => item.id === interactionId)
    if (!interaction) return null
    return {
      initialStateId: interaction.initialStateId,
      states: interaction.states.map((state) => ({ ...state })),
      transitions: interaction.transitions.map((transition) => ({ ...transition }))
    }
  }

  return {
    events: DEVICE_PROTOTYPE_EVENTS,
    interactions,
    interactionOptions,
    selectedInteractionId,
    selectedInteraction,
    states,
    transitions,
    initialStateId,
    selectedStateId,
    selectedState,
    addInteraction,
    createInteractionFromDefinition,
    removeInteraction,
    selectInteraction,
    renameInteraction,
    addFrame,
    removeState,
    setInitialState,
    selectState,
    transitionTarget,
    setTransition,
    definition
  }
}
