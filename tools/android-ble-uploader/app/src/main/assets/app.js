(function () {
  const protocol = window.OpenPencilProtocol
  const canvas = document.getElementById('previewCanvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const fileInput = document.getElementById('fileInput')
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

  function drawBitmap(targetContext, bitmap) {
    const width = protocol.WIDTH
    const height = protocol.HEIGHT
    targetContext.fillStyle = backgroundInput.value
    targetContext.fillRect(0, 0, width, height)
    const baseScale = Math.max(width / bitmap.width, height / bitmap.height)
    const scale = baseScale * zoom
    const drawWidth = bitmap.width * scale
    const drawHeight = bitmap.height * scale
    targetContext.imageSmoothingEnabled = true
    targetContext.imageSmoothingQuality = 'high'
    targetContext.drawImage(
      bitmap,
      (width - drawWidth) / 2 + offsetX,
      (height - drawHeight) / 2 + offsetY,
      drawWidth,
      drawHeight
    )
  }

  function renderPreview() {
    context.fillStyle = backgroundInput.value
    context.fillRect(0, 0, protocol.WIDTH, protocol.HEIGHT)
    if (previewBitmap) drawBitmap(context, previewBitmap)
  }

  async function loadPreview() {
    if (previewBitmap) previewBitmap.close()
    previewBitmap = files.length ? await createImageBitmap(files[0]) : null
    emptyPreview.hidden = Boolean(previewBitmap)
    setEditing(Boolean(previewBitmap))
    resetCrop()
  }

  async function renderFile(file) {
    const bitmap = await createImageBitmap(file)
    const frameCanvas = document.createElement('canvas')
    frameCanvas.width = protocol.WIDTH
    frameCanvas.height = protocol.HEIGHT
    const frameContext = frameCanvas.getContext('2d', { willReadFrequently: true })
    drawBitmap(frameContext, bitmap)
    bitmap.close()
    return protocol.rgb565(frameContext.getImageData(0, 0, protocol.WIDTH, protocol.HEIGHT))
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

  fileInput.addEventListener('change', async () => {
    files = [...fileInput.files]
    fileSummary.textContent = files.length
      ? files.length === 1
        ? '单帧图片 · 466 × 466'
        : `${files.length} 帧 PNG 序列 · 20 FPS`
      : '支持单图或 PNG 序列，目标 466 × 466。'
    payloadSummary.textContent = '尚未准备内容'
    progressBar.style.width = '0%'
    setStatus(files.length ? '编辑已激活，调整完成后点击“完成”' : '选择图片后即可上传')
    await loadPreview()
    updateActions()
  })

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
