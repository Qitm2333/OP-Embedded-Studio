(function () {
  const protocol = window.OpenPencilProtocol
  const canvas = document.getElementById('previewCanvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const fileInput = document.getElementById('fileInput')
  const connectButton = document.getElementById('connectButton')
  const disconnectButton = document.getElementById('disconnectButton')
  const uploadButton = document.getElementById('uploadButton')
  const zoomInput = document.getElementById('zoomInput')
  const backgroundInput = document.getElementById('backgroundInput')
  const containButton = document.getElementById('containButton')
  const coverButton = document.getElementById('coverButton')
  const resetButton = document.getElementById('resetButton')
  const statusText = document.getElementById('statusText')
  const progressBar = document.getElementById('progressBar')
  const connectionBadge = document.getElementById('connectionBadge')
  const fileSummary = document.getElementById('fileSummary')
  const payloadSummary = document.getElementById('payloadSummary')
  const emptyPreview = document.getElementById('emptyPreview')

  let files = []
  let previewBitmap = null
  let connected = false
  let busy = false
  let fitMode = 'contain'
  let zoom = 1
  let offsetX = 0
  let offsetY = 0
  let pointer = null

  function setStatus(message, type = '') {
    statusText.textContent = message
    statusText.className = `status ${type}`
  }

  function updateActions() {
    connectButton.disabled = connected || busy
    disconnectButton.disabled = !connected || busy
    uploadButton.disabled = !connected || files.length === 0 || busy
  }

  function resetCrop() {
    zoom = 1
    offsetX = 0
    offsetY = 0
    zoomInput.value = '100'
    renderPreview()
  }

  function drawBitmap(targetContext, bitmap) {
    const width = protocol.WIDTH
    const height = protocol.HEIGHT
    targetContext.fillStyle = backgroundInput.value
    targetContext.fillRect(0, 0, width, height)
    const baseScale = fitMode === 'cover'
      ? Math.max(width / bitmap.width, height / bitmap.height)
      : Math.min(width / bitmap.width, height / bitmap.height)
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

  async function processAndUpload() {
    if (!window.OpenPencilNative) return setStatus('原生 BLE 桥不可用', 'error')
    busy = true
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
      setStatus('正在交给原生 BLE 传输模块…')
      sendPayloadToNative(content)
      window.OpenPencilNative.upload()
    } catch (error) {
      busy = false
      updateActions()
      setStatus(error instanceof Error ? error.message : String(error), 'error')
    }
  }

  fileInput.addEventListener('change', async () => {
    files = [...fileInput.files]
    fileSummary.textContent = files.length
      ? files.length === 1
        ? `${files[0].name} · 单帧`
        : `${files[0].name} 等 ${files.length} 帧 · 20 FPS`
      : '支持单图或 PNG 序列，目标 466 × 466。'
    payloadSummary.textContent = '尚未准备内容'
    await loadPreview()
    updateActions()
  })

  connectButton.addEventListener('click', () => window.OpenPencilNative?.connect())
  disconnectButton.addEventListener('click', () => window.OpenPencilNative?.disconnect())
  uploadButton.addEventListener('click', processAndUpload)
  resetButton.addEventListener('click', resetCrop)
  backgroundInput.addEventListener('input', renderPreview)
  zoomInput.addEventListener('input', () => {
    zoom = Number(zoomInput.value) / 100
    renderPreview()
  })
  containButton.addEventListener('click', () => {
    fitMode = 'contain'
    containButton.classList.add('active')
    coverButton.classList.remove('active')
    resetCrop()
  })
  coverButton.addEventListener('click', () => {
    fitMode = 'cover'
    coverButton.classList.add('active')
    containButton.classList.remove('active')
    resetCrop()
  })

  canvas.parentElement.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY, offsetX, offsetY }
    canvas.parentElement.setPointerCapture(event.pointerId)
  })
  canvas.parentElement.addEventListener('pointermove', (event) => {
    if (!pointer) return
    const scale = protocol.WIDTH / canvas.parentElement.clientWidth
    offsetX = pointer.offsetX + (event.clientX - pointer.x) * scale
    offsetY = pointer.offsetY + (event.clientY - pointer.y) * scale
    renderPreview()
  })
  canvas.parentElement.addEventListener('pointerup', () => { pointer = null })
  canvas.parentElement.addEventListener('pointercancel', () => { pointer = null })

  window.OpenPencilApp = {
    nativeEvent(event) {
      if (event.type === 'connected') {
        connected = true
        connectionBadge.textContent = '已连接'
        connectionBadge.classList.add('connected')
        setStatus(event.message, 'success')
      } else if (event.type === 'disconnected') {
        connected = false
        busy = false
        connectionBadge.textContent = '未连接'
        connectionBadge.classList.remove('connected')
        setStatus(event.message)
      } else if (event.type === 'progress') {
        const percent = event.total ? Math.round(event.written / event.total * 100) : 0
        progressBar.style.width = `${percent}%`
        setStatus(`${event.message}：${percent}%`)
      } else if (event.type === 'complete') {
        busy = false
        progressBar.style.width = '100%'
        setStatus(event.message, 'success')
      } else if (event.type === 'error') {
        busy = false
        setStatus(event.message, 'error')
      } else {
        setStatus(event.message)
      }
      updateActions()
    }
  }

  renderPreview()
  updateActions()
})()
