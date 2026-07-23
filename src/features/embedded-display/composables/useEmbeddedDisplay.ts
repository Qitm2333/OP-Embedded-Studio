import { computed, onMounted, onUnmounted, ref } from 'vue'

import { createEmbeddedDisplayHttpAdapter, embeddedArtifactUrl } from '../adapters/http'
import {
  imageFileToRgb565,
  prototypeBakeToRgb565,
  type EmbeddedImagePlacement
} from '../adapters/image'
import { MOCK_DISPLAY_VARIABLES } from '../adapters/mock'
import type {
  EmbeddedBuildMode,
  EmbeddedBuildStatus,
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
  EmbeddedPrototypeBakeResult,
  EmbeddedPrototypePayload,
  EmbeddedWifiCredentials
} from '../model/types'

const adapter = createEmbeddedDisplayHttpAdapter()
const profiles = ref<EmbeddedDisplayProfile[]>([])
const selectedProfileId = ref('')
const selectedImageName = ref('')
const previewUrl = ref('')
const imagePayload = ref<EmbeddedImagePayload | null>(null)
const prototypePayload = ref<EmbeddedPrototypePayload | null>(null)
const buildStatus = ref<EmbeddedBuildStatus>('loading')
const buildMessage = ref('正在连接设备服务…')
const buildLog = ref<string[]>([])
const manifestUrls = ref<Partial<Record<EmbeddedBuildMode, string>>>({})
const serviceAvailable = ref(false)
let loaded = false

function deviceLog(message: string, details?: unknown) {
  if (details === undefined) console.info('[embedded-display]', message)
  else console.info('[embedded-display]', message, details)
}

export function useEmbeddedDisplay() {
  const selectedProfile = computed(
    () => profiles.value.find((profile) => profile.id === selectedProfileId.value) ?? null
  )

  async function loadProfiles() {
    if (loaded) return
    deviceLog('loading profiles')
    buildStatus.value = 'loading'
    buildMessage.value = '正在读取屏幕方案…'
    try {
      profiles.value = await adapter.listProfiles()
      selectedProfileId.value = profiles.value[0]?.id ?? ''
      serviceAvailable.value = true
      loaded = true
      deviceLog('service ready', { profileCount: profiles.value.length })
      buildStatus.value = 'idle'
      buildMessage.value = '请选择图片，然后生成固件。未选择图片时将使用默认测试图。'
    } catch (error) {
      serviceAvailable.value = false
      deviceLog('service error', error)
      buildStatus.value = 'error'
      buildMessage.value = `无法连接设备服务：${error instanceof Error ? error.message : String(error)}`
    }
  }

  function selectProfile(id: string) {
    if (profiles.value.some((profile) => profile.id === id)) {
      selectedProfileId.value = id
      manifestUrls.value = {}
      imagePayload.value = null
      prototypePayload.value = null
      deviceLog('profile selected', { profileId: id })
      if (selectedImageName.value) {
        buildMessage.value = '屏幕方案已切换，请重新选择图片后再生成固件。'
      }
    }
  }

  async function selectImage(
    file: File | undefined,
    options: {
      upload?: boolean
      placement?: EmbeddedImagePlacement
      backgroundColor?: string
    } = {}
  ) {
    const uploadToBuildService = options.upload ?? true
    selectedImageName.value = file?.name ?? ''
    deviceLog('image selected', {
      name: file?.name,
      size: file?.size,
      type: file?.type
    })
    manifestUrls.value['usb-frame'] = ''
    if (!file) {
      imagePayload.value = null
      buildStatus.value = 'idle'
      buildMessage.value = '未选择图片时，将使用默认测试图。'
      return
    }
    const profile = selectedProfile.value
    if (!profile) {
      buildStatus.value = 'error'
      buildMessage.value = '请先连接设备服务并选择屏幕方案。'
      return
    }
    buildStatus.value = 'uploading'
    buildMessage.value = uploadToBuildService
      ? `正在转换并上传素材：${file.name}`
      : `正在转换素材：${file.name}`
    try {
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = URL.createObjectURL(file)
      const payload = await imageFileToRgb565(file, profile, {
        placement: options.placement,
        backgroundColor: options.backgroundColor
      })
      imagePayload.value = payload
      deviceLog('image payload ready', {
        profileId: payload.profileId,
        width: payload.width,
        height: payload.height,
        encodedLength: payload.pixelsRgb565Base64.length
      })
      if (uploadToBuildService) {
        await adapter.uploadImage(payload)
        deviceLog('image uploaded to build service')
      } else {
        deviceLog('image prepared for wireless transfer')
      }
      buildStatus.value = 'idle'
      buildMessage.value = uploadToBuildService
        ? '图片已上传，可以生成固件。'
        : '图片已准备，可以通过 Wi-Fi 传输。'
      buildLog.value = [
        `image: ${file.name}`,
        `size: ${profile.resolution.width}×${profile.resolution.height}`,
        uploadToBuildService ? 'build-resource: ok' : 'wireless-payload: ready'
      ]
    } catch (error) {
      deviceLog('image upload error', error)
      buildStatus.value = 'error'
      buildMessage.value = `${uploadToBuildService ? '图片上传' : '图片转换'}失败：${error instanceof Error ? error.message : String(error)}`
    }
  }

  async function selectPrototype(
    bake: EmbeddedPrototypeBakeResult,
    options: { upload?: boolean; backgroundColor?: string } = {}
  ) {
    const profile = selectedProfile.value
    if (!profile) throw new Error('请先连接设备服务并选择屏幕方案')
    const uploadToBuildService = options.upload ?? true
    manifestUrls.value['usb-prototype'] = ''
    buildStatus.value = 'uploading'
    buildMessage.value = uploadToBuildService
      ? `正在批量烘焙并上传交互：${bake.name}`
      : `正在批量烘焙交互：${bake.name}`
    try {
      const payload = await prototypeBakeToRgb565(bake, profile, options.backgroundColor)
      prototypePayload.value = payload
      deviceLog('prototype payload ready', {
        profileId: payload.profileId,
        states: payload.states.length,
        transitions: payload.transitions.length,
        encodedLength: payload.pixelsRgb565Base64.length
      })
      if (uploadToBuildService) await adapter.uploadPrototype(payload)
      buildStatus.value = 'idle'
      buildMessage.value = uploadToBuildService
        ? '状态机资源已上传，可以生成固件。'
        : '状态机资源已准备，可以通过无线方式传输。'
      buildLog.value = [
        `prototype: ${bake.name}`,
        `states: ${payload.states.length}`,
        `transitions: ${payload.transitions.length}`,
        `size: ${profile.resolution.width}×${profile.resolution.height}`,
        uploadToBuildService ? 'upload: ok' : 'wireless-payload: ready'
      ]
    } catch (error) {
      deviceLog('prototype upload error', error)
      buildStatus.value = 'error'
      buildMessage.value = `状态机资源准备失败：${error instanceof Error ? error.message : String(error)}`
      throw error
    }
  }
  function manifestUrlFor(buildMode: EmbeddedBuildMode): string {
    return manifestUrls.value[buildMode] ?? ''
  }

  async function loadCachedFirmware(buildMode: EmbeddedBuildMode): Promise<boolean> {
    const profile = selectedProfile.value
    if (!profile || !serviceAvailable.value) return false
    try {
      await adapter.getManifest(profile.id, buildMode)
      if (selectedProfile.value?.id !== profile.id) return false
      manifestUrls.value[buildMode] = embeddedArtifactUrl(profile.id, 'manifest.json', buildMode)
      deviceLog('cached firmware ready', { profileId: profile.id, buildMode })
      return true
    } catch {
      if (selectedProfile.value?.id === profile.id) manifestUrls.value[buildMode] = ''
      return false
    }
  }

  async function buildFirmware(
    buildMode: EmbeddedBuildMode,
    wifiCredentials?: EmbeddedWifiCredentials
  ): Promise<boolean> {
    const profile = selectedProfile.value
    if (!profile || !serviceAvailable.value) return false
    deviceLog('build requested', { profileId: profile.id, buildMode })
    buildStatus.value = 'building'
    buildMessage.value = '正在调用 ESP-IDF 构建服务…'
    manifestUrls.value[buildMode] = ''
    try {
      const result = await adapter.build(profile.id, buildMode, wifiCredentials)
      buildLog.value = result.logTail || []
      if (!result.ok) {
        throw new Error(result.error || `构建失败（${result.returnCode ?? 'unknown'}）`)
      }
      const manifest = await adapter.getManifest(profile.id, buildMode)
      if (selectedProfile.value?.id !== profile.id) return false
      deviceLog('build ready', {
        appBytes: result.size?.appBytes,
        logLines: result.logTail?.length,
        flashParts: manifest.builds[0]?.parts.length ?? 0
      })
      buildStatus.value = 'ready'
      buildMessage.value = '固件和烧录清单已生成，可以连接设备并烧录。'
      manifestUrls.value[buildMode] = embeddedArtifactUrl(profile.id, 'manifest.json', buildMode)
      return true
    } catch (error) {
      deviceLog('build error', error)
      buildStatus.value = 'error'
      buildMessage.value = `固件构建失败：${error instanceof Error ? error.message : String(error)}`
      return false
    }
  }

  async function clearGeneratedImage() {
    await adapter.clearImage()
    imagePayload.value = null
    selectedImageName.value = ''
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }
  }

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
    if (reason.includes('dynamically imported module') || reason.includes('install-dialog')) {
      deviceLog('web serial module load error', event.reason)
    }
  }

  onMounted(() => {
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    void loadProfiles()
  })

  onUnmounted(() => {
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  })

  return {
    selectedProfile,
    profiles,
    variables: MOCK_DISPLAY_VARIABLES,
    selectedImageName,
    buildStatus,
    buildMessage,
    buildLog,
    manifestUrlFor,
    previewUrl,
    imagePayload,
    prototypePayload,
    serviceAvailable,
    selectProfile,
    selectImage,
    selectPrototype,
    buildFirmware,
    loadCachedFirmware,
    clearGeneratedImage,
    loadProfiles
  }
}
