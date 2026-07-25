(function () {
  const protocol = window.OpenPencilProtocol
  const canvas = document.getElementById('previewCanvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const fileInput = document.getElementById('fileInput')
  const cameraInput = document.getElementById('cameraInput')
  const editButton = document.getElementById('editButton')
  const uploadButton = document.getElementById('uploadButton')
  const backgroundInput = document.getElementById('backgroundInput')
  const resetButton = document.getElementById('resetButton')
  const statusText = document.getElementById('statusText')
  const progressBar = document.getElementById('progressBar')
  const connectionBadge = document.getElementById('connectionBadge')
  const fileSummary = document.getElementById('fileSummary')
  const payloadSummary = document.getElementById('payloadSummary')
  const emptyPreview = document.getElementById('emptyPreview')
  const editHint = document.getElementById('editHint')
  const editControls = document.getElementById('editControls')
  const previewWrap = document.getElementById('previewWrap')

  const pointers = new Map()
  let files = []
  let previewBitmap = null
  let connected = false
  let connecting = false
  let busy = false
  let pendingUpload = false
  let editing = false
  let zoom = 1
  let offsetX = 0
  let offsetY = 0
  let gesture = null

  function setStatus(message, type = '') {
    statusText.textContent = message
    statusText.className = `status ${type}`
  }

  function updateConnectionBadge() {
    connectionBadge.className = 'badge'
    if (connected) {
      connectionBadge.textContent = '已连接'
      connectionBadge.classList.add('connected')
    } else if (connecting) {
      connectionBadge.textContent = '连接中'
      connectionBadge.classList.add('connecting')
    } else {
      connectionBadge.textContent = '按需连接'
    }
  }

  function updateActions() {
    fileInput.disabled = busy
    cameraInput.disabled = busy
    editButton.disabled = files.length === 0 || busy
    uploadButton.disabled = files.length === 0 || busy
    editButton.textContent = editing ? '完成' : '编辑'
    editButton.classList.toggle('active', editing)
  }

  function clearGesture() {
    pointers.clear()
    gesture = null
  }

  function setEditing(nextEditing) {
    editing = Boolean(nextEditing && previewBitmap && !busy)
    previewWrap.classList.toggle('editing', editing)
    previewWrap.classList.toggle('locked', !editing)
    editControls.classList.toggle('visible', editing)
    editControls.setAttribute('aria-hidden', String(!editing))
    editHint.hidden = !editing
    clearGesture()
    updateActions()
  }

  function resetCrop() {
    zoom = 1
    offsetX = 0
    offsetY = 0
    renderPreview()
  }

  function releaseBitmap(bitmap) {
    if (bitmap?.close) bitmap.close()
  }

  async function decodeWithImageElement(file) {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.decoding = 'async'
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = () => reject(new Error('HTML image decode failed'))
        image.src = objectUrl
      })
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Invalid image dimensions')
      return {
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close() {
          image.src = ''
          URL.revokeObjectURL(objectUrl)
        }
      }
    } catch (error) {
      image.src = ''
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  async function decodeImageFile(file) {
    if (!file || file.size <= 0) throw new Error('图片文件为空，请确认照片已完整下载到手机')
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(file)
        if (!bitmap.width || !bitmap.height) throw new Error('Invalid bitmap dimensions')
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          close() {
            bitmap.close()
          }
        }
      } catch {
        // Some Android gallery providers are not supported by createImageBitmap.
      }
    }
    try {
      return await decodeWithImageElement(file)
    } catch {
      const fileType = file.type || '未知格式'
      const fileSize = `${(file.size / 1024 / 1024).toFixed(2)} MiB`
      throw new Error(`无法读取图片（${fileType}，${fileSize}），请确认照片已完整下载到手机`)
    }
  }

  function drawBitmap(targetContext, bitmap) {
    const width = protocol.WIDTH
    const height = protocol.HEIGHT
    targetContext.fillStyle = backgroundInput.value
    targetContext.fillRect(0, 0, width, height)
    const baseScale = Math.max(width / bitmap.width, height / bitmap.height)
    const scale = baseScale * zoom
    const drawWidth = bitmap.width * scale
    const drawHeight = bitmap.height * scale
    const drawX = (width - drawWidth) / 2 + offsetX
    const drawY = (height - drawHeight) / 2 + offsetY
    const visibleLeft = Math.max(0, drawX)
    const visibleTop = Math.max(0, drawY)
    const visibleRight = Math.min(width, drawX + drawWidth)
    const visibleBottom = Math.min(height, drawY + drawHeight)
    const visibleWidth = visibleRight - visibleLeft
    const visibleHeight = visibleBottom - visibleTop
    if (visibleWidth <= 0 || visibleHeight <= 0) return
    targetContext.imageSmoothingEnabled = true
    targetContext.imageSmoothingQuality = 'high'
    targetContext.drawImage(
      bitmap.source,
      (visibleLeft - drawX) / scale,
      (visibleTop - drawY) / scale,
      visibleWidth / scale,
      visibleHeight / scale,
      visibleLeft,
      visibleTop,
      visibleWidth,
      visibleHeight
    )
  }

  function renderPreview() {
    context.fillStyle = backgroundInput.value
    context.fillRect(0, 0, protocol.WIDTH, protocol.HEIGHT)
    if (previewBitmap) drawBitmap(context, previewBitmap)
  }

  async function loadPreview() {
    releaseBitmap(previewBitmap)
    previewBitmap = files.length ? await decodeImageFile(files[0]) : null
    emptyPreview.hidden = Boolean(previewBitmap)
    setEditing(Boolean(previewBitmap))
    resetCrop()
  }

  async function renderFile(file) {
    const bitmap = await decodeImageFile(file)
    try {
      const frameCanvas = document.createElement('canvas')
      frameCanvas.width = protocol.WIDTH
      frameCanvas.height = protocol.HEIGHT
      const frameContext = frameCanvas.getContext('2d', { willReadFrequently: true })
      drawBitmap(frameContext, bitmap)
      return protocol.rgb565(frameContext.getImageData(0, 0, protocol.WIDTH, protocol.HEIGHT))
    } finally {
      releaseBitmap(bitmap)
    }
  }

  function bytesToBase64(bytes) {
    let binary = ''
    const chunk = 0x4000
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
    }
    return btoa(binary)
  }

  function sendPayloadToNative(content) {
    let error = window.OpenPencilNative.beginPayload(content.byteLength)
    if (error) throw new Error(error)
    const chunkBytes = 48 * 1024
    for (let offset = 0; offset < content.byteLength; offset += chunkBytes) {
      error = window.OpenPencilNative.appendPayloadChunk(
        bytesToBase64(content.subarray(offset, Math.min(offset + chunkBytes, content.byteLength)))
      )
      if (error) throw new Error(error)
    }
    error = window.OpenPencilNative.finishPayload()
    if (error) throw new Error(error)
  }

  function startNativeUpload() {
    pendingUpload = false
    setStatus('设备已连接，正在上传…')
    window.OpenPencilNative.upload()
  }

  async function processAndUpload() {
    if (!window.OpenPencilNative) return setStatus('原生 BLE 桥不可用', 'error')
    busy = true
    pendingUpload = false
    updateActions()
    progressBar.style.width = '0%'
    try {
      if (files.length > 1 && files.some((file) => !file.name.toLowerCase().endsWith('.png'))) {
        throw new Error('多帧序列只支持 PNG 文件')
      }
      const sorted = [...files].sort((left, right) =>
        left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
      )
      const frames = []
      for (let index = 0; index < sorted.length; index += 1) {
        setStatus(`正在处理第 ${index + 1} / ${sorted.length} 帧…`)
        frames.push(await renderFile(sorted[index]))
      }
      const content = frames.length === 1
        ? protocol.encodeFrame(frames[0])
        : protocol.encodeSequence(frames)
      payloadSummary.textContent = `${frames.length} 帧 · ${(content.byteLength / 1024 / 1024).toFixed(2)} MiB`
      setStatus('内容已准备，正在查找设备…')
      sendPayloadToNative(content)
      if (connected) {
        startNativeUpload()
      } else {
        pendingUpload = true
        connecting = true
        updateConnectionBadge()
        window.OpenPencilNative.connect()
      }
    } catch (error) {
      busy = false
      pendingUpload = false
      connecting = false
      updateConnectionBadge()
      updateActions()
      setStatus(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  function canvasPoint(event) {
    const bounds = previewWrap.getBoundingClientRect()
    const scale = protocol.WIDTH / bounds.width
    return {
      x: (event.clientX - bounds.left) * scale - protocol.WIDTH / 2,
      y: (event.clientY - bounds.top) * scale - protocol.HEIGHT / 2
    }
  }

  function pointerPair() {
    return [...pointers.values()].slice(0, 2)
  }

  function beginGesture() {
    if (pointers.size === 1) {
      const point = [...pointers.values()][0]
      gesture = { type: 'pan', point, offsetX, offsetY }
      return
    }
    if (pointers.size >= 2) {
      const [first, second] = pointerPair()
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
      gesture = {
        type: 'pinch',
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        center,
        zoom,
        offsetX,
        offsetY
      }
    }
  }

  async function handleFileSelection(input) {
    files = [...input.files]
    fileSummary.textContent = files.length
      ? files.length === 1
        ? '单帧图片 · 466 × 466'
        : `${files.length} 帧 PNG 序列 · 20 FPS`
      : '支持单图或 PNG 序列，目标 466 × 466。'
    payloadSummary.textContent = '尚未准备内容'
    progressBar.style.width = '0%'
    setStatus(files.length ? '编辑已激活，调整完成后点击“完成”' : '选择图片后即可上传')
    try {
      await loadPreview()
    } catch (error) {
      files = []
      input.value = ''
      releaseBitmap(previewBitmap)
      previewBitmap = null
      emptyPreview.hidden = false
      setEditing(false)
      fileSummary.textContent = '支持单图或 PNG 序列，目标 466 × 466。'
      setStatus(error instanceof Error ? error.message : String(error), 'error')
    } finally {
      updateActions()
    }
  }

  fileInput.addEventListener('change', () => handleFileSelection(fileInput))
  cameraInput.addEventListener('change', () => handleFileSelection(cameraInput))

  editButton.addEventListener('click', () => setEditing(!editing))
  uploadButton.addEventListener('click', processAndUpload)
  resetButton.addEventListener('click', resetCrop)
  backgroundInput.addEventListener('input', renderPreview)

  previewWrap.addEventListener('pointerdown', (event) => {
    if (!editing || !previewBitmap) return
    event.preventDefault()
    pointers.set(event.pointerId, canvasPoint(event))
    previewWrap.setPointerCapture(event.pointerId)
    beginGesture()
  })

  previewWrap.addEventListener('pointermove', (event) => {
    if (!editing || !pointers.has(event.pointerId)) return
    event.preventDefault()
    pointers.set(event.pointerId, canvasPoint(event))
    if (pointers.size === 1 && gesture?.type === 'pan') {
      const point = [...pointers.values()][0]
      offsetX = gesture.offsetX + point.x - gesture.point.x
      offsetY = gesture.offsetY + point.y - gesture.point.y
      renderPreview()
      return
    }
    if (pointers.size >= 2 && gesture?.type === 'pinch') {
      const [first, second] = pointerPair()
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y))
      const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
      const nextZoom = Math.min(6, Math.max(0.2, gesture.zoom * distance / Math.max(1, gesture.distance)))
      const ratio = nextZoom / gesture.zoom
      zoom = nextZoom
      offsetX = center.x - (gesture.center.x - gesture.offsetX) * ratio
      offsetY = center.y - (gesture.center.y - gesture.offsetY) * ratio
      renderPreview()
    }
  })

  function releasePointer(event) {
    if (!pointers.has(event.pointerId)) return
    pointers.delete(event.pointerId)
    beginGesture()
  }

  previewWrap.addEventListener('pointerup', releasePointer)
  previewWrap.addEventListener('pointercancel', releasePointer)
  previewWrap.addEventListener('lostpointercapture', releasePointer)

  window.OpenPencilApp = {
    nativeEvent(event) {
      if (event.type === 'connected') {
        connected = true
        connecting = false
        updateConnectionBadge()
        if (pendingUpload) startNativeUpload()
        else setStatus(event.message, 'success')
      } else if (event.type === 'disconnected') {
        connected = false
        connecting = false
        pendingUpload = false
        busy = false
        updateConnectionBadge()
        setStatus(event.message)
      } else if (event.type === 'progress') {
        const percent = event.total ? Math.round(event.written / event.total * 100) : 0
        progressBar.style.width = `${percent}%`
        setStatus(`${event.message}：${percent}%`)
      } else if (event.type === 'complete') {
        busy = false
        pendingUpload = false
        progressBar.style.width = '100%'
        setStatus(event.message, 'success')
      } else if (event.type === 'error') {
        busy = false
        pendingUpload = false
        if (connecting) connected = false
        connecting = false
        updateConnectionBadge()
        setStatus(event.message, 'error')
      } else {
        setStatus(event.message)
      }
      updateActions()
    }
  }

  updateConnectionBadge()
  renderPreview()
  updateActions()
})()
