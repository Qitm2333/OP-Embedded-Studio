const MAX_IMAGE_FRAMES = 120;
const MAX_IMAGE_RAW_BYTES = 4 * 1024 * 1024;
const APP_PARTITION_BYTES = 0x600000;
const INSTALL_BUTTON_TAG = "esp-web-install-button";
const INSTALL_BUTTON_MODULE_URLS = [
  "https://cdn.jsdelivr.net/npm/esp-web-tools@10/dist/web/install-button.js",
];

const state = {
  registry: null,
  selectedProfile: null,
  lastBuild: null,
  imagePayload: null,
  imageFiles: [],
  sourceFrames: [],
  previewFrames: [],
  previewFrameIndex: 0,
  previewTimer: null,
  previewPlaying: false,
  gifParserPromise: null,
  installButtonLoaderPromise: null,
};

const els = {
  serverStatus: document.querySelector("#serverStatus"),
  profileList: document.querySelector("#profileList"),
  currentProfileToggle: document.querySelector("#currentProfileToggle"),
  currentProfileToggleLabel: document.querySelector("#currentProfileToggleLabel"),
  currentProfileDetails: document.querySelector("#currentProfileDetails"),
  currentProfileName: document.querySelector("#currentProfileName"),
  boardName: document.querySelector("#boardName"),
  driverIc: document.querySelector("#driverIc"),
  resolution: document.querySelector("#resolution"),
  interfaceName: document.querySelector("#interfaceName"),
  visibleArea: document.querySelector("#visibleArea"),
  wiringToggle: document.querySelector("#wiringToggle"),
  wiringToggleLabel: document.querySelector("#wiringToggleLabel"),
  wiringContent: document.querySelector("#wiringContent"),
  wiringDiagram: document.querySelector("#wiringDiagram"),
  wiringBody: document.querySelector("#wiringBody"),
  backlightNote: document.querySelector("#backlightNote"),
  imageInput: document.querySelector("#imageInput"),
  selectedFilesLabel: document.querySelector("#selectedFilesLabel"),
  selectedFilesMeta: document.querySelector("#selectedFilesMeta"),
  imageFitMode: document.querySelector("#imageFitMode"),
  imageRotation: document.querySelector("#imageRotation"),
  imageBgColor: document.querySelector("#imageBgColor"),
  imageBgText: document.querySelector("#imageBgText"),
  imageFps: document.querySelector("#imageFps"),
  framePickMode: document.querySelector("#framePickMode"),
  imageMaxFrames: document.querySelector("#imageMaxFrames"),
  imageDropZone: document.querySelector("#imageDropZone"),
  uploadImageButton: document.querySelector("#uploadImageButton"),
  clearImageButton: document.querySelector("#clearImageButton"),
  imageState: document.querySelector("#imageState"),
  imageStats: document.querySelector("#imageStats"),
  sourceFrameCount: document.querySelector("#sourceFrameCount"),
  selectedFrameCount: document.querySelector("#selectedFrameCount"),
  imageRawSize: document.querySelector("#imageRawSize"),
  imageRawFree: document.querySelector("#imageRawFree"),
  profileMaxFrames: document.querySelector("#profileMaxFrames"),
  previewPanel: document.querySelector("#previewPanel"),
  imagePreview: document.querySelector("#imagePreview"),
  prevFrameButton: document.querySelector("#prevFrameButton"),
  playPreviewButton: document.querySelector("#playPreviewButton"),
  nextFrameButton: document.querySelector("#nextFrameButton"),
  previewFrameSlider: document.querySelector("#previewFrameSlider"),
  previewFrameLabel: document.querySelector("#previewFrameLabel"),
  buildButton: document.querySelector("#buildButton"),
  buildState: document.querySelector("#buildState"),
  serialSupport: document.querySelector("#serialSupport"),
  buildReady: document.querySelector("#buildReady"),
  artifactPanel: document.querySelector("#artifactPanel"),
  appSize: document.querySelector("#appSize"),
  appFree: document.querySelector("#appFree"),
  appBin: document.querySelector("#appBin"),
  bootloaderBin: document.querySelector("#bootloaderBin"),
  partitionTableBin: document.querySelector("#partitionTableBin"),
  flashArgs: document.querySelector("#flashArgs"),
  manifestLink: document.querySelector("#manifestLink"),
  installButton: document.querySelector("#installButton"),
  reloadInstallButton: document.querySelector("#reloadInstallButton"),
  flashHint: document.querySelector("#flashHint"),
  logTail: document.querySelector("#logTail"),
  steps: {
    select: document.querySelector("#stepSelect"),
    build: document.querySelector("#stepBuild"),
    flash: document.querySelector("#stepFlash"),
    verify: document.querySelector("#stepVerify"),
  },
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `请求失败：${response.status}`);
  }
  return payload;
}

function setInstallButtonAvailability(isAvailable, message = "") {
  els.installButton.classList.toggle("hidden", !isAvailable);
  els.reloadInstallButton.classList.toggle("hidden", isAvailable);
  if (message) {
    els.flashHint.textContent = message;
  }
}

function setServerStatus(ok, text) {
  els.serverStatus.textContent = text;
  els.serverStatus.classList.toggle("ok", ok);
  els.serverStatus.classList.toggle("error", !ok);
}

function setStep(activeStep) {
  Object.entries(els.steps).forEach(([name, element]) => {
    element.classList.toggle("active", name === activeStep);
    element.classList.toggle("done", stepRank(name) < stepRank(activeStep));
  });
}

function stepRank(name) {
  return { select: 0, build: 1, flash: 2, verify: 3 }[name] || 0;
}

function updateSerialSupport() {
  const isSupported = "serial" in navigator;
  els.serialSupport.classList.toggle("ok", isSupported);
  els.serialSupport.classList.toggle("error", !isSupported);
  els.serialSupport.textContent = isSupported ? "浏览器串口可用" : "浏览器不支持串口烧录";
  els.flashHint.textContent = isSupported
    ? "点击右侧 Connect 按钮，选择开发板串口后自动烧录。"
    : "请使用 Chrome 或 Edge 打开本页面后再烧录。";
  return isSupported;
}

async function ensureInstallButtonReady() {
  if (customElements.get(INSTALL_BUTTON_TAG)) {
    setInstallButtonAvailability(true);
    return true;
  }

  if (state.installButtonLoaderPromise) {
    return state.installButtonLoaderPromise;
  }

  state.installButtonLoaderPromise = (async () => {
    for (const url of INSTALL_BUTTON_MODULE_URLS) {
      try {
        await import(url);
        if (customElements.get(INSTALL_BUTTON_TAG)) {
          setInstallButtonAvailability(true);
          return true;
        }
      } catch (error) {
        console.warn(`install button load failed: ${url}`, error);
      }
    }

    setInstallButtonAvailability(
      false,
      "Connect 按钮加载失败，可点击右侧“重试加载 Connect”；如果仍失败，请刷新页面或检查网络。",
    );
    return false;
  })();

  const result = await state.installButtonLoaderPromise;
  state.installButtonLoaderPromise = null;
  return result;
}

function setBuildReady(isReady) {
  els.buildReady.classList.toggle("ok", isReady);
  els.buildReady.classList.toggle("error", !isReady);
  els.buildReady.textContent = isReady ? "固件已生成" : "等待生成";
}

function setCurrentProfileExpanded(isExpanded) {
  els.currentProfileToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  els.currentProfileToggleLabel.textContent = isExpanded ? "收起" : "展开";
  els.currentProfileDetails.classList.toggle("hidden", !isExpanded);
}

function toggleCurrentProfile() {
  const isExpanded = els.currentProfileToggle.getAttribute("aria-expanded") === "true";
  setCurrentProfileExpanded(!isExpanded);
}

function setWiringExpanded(isExpanded) {
  els.wiringToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  els.wiringToggleLabel.textContent = isExpanded ? "收起" : "展开";
  els.wiringContent.classList.toggle("hidden", !isExpanded);
}

function toggleWiringPanel() {
  const isExpanded = els.wiringToggle.getAttribute("aria-expanded") === "true";
  setWiringExpanded(!isExpanded);
}

function resetBuildResult() {
  state.lastBuild = null;
  setBuildReady(false);
  els.artifactPanel.classList.add("hidden");
  els.logTail.textContent = "";
  els.appSize.textContent = "-";
  els.appFree.textContent = "-";
  els.appBin.textContent = "-";
  els.bootloaderBin.textContent = "-";
  els.partitionTableBin.textContent = "-";
  els.flashArgs.textContent = "-";
  els.manifestLink.textContent = "-";
  els.manifestLink.removeAttribute("href");
  els.installButton.removeAttribute("manifest");
}

function resetImageSelection() {
  stopPreviewPlayback();
  state.imagePayload = null;
  state.imageFiles = [];
  state.sourceFrames = [];
  state.previewFrames = [];
  state.previewFrameIndex = 0;
  els.imageInput.value = "";
  summarizeSelectedFiles();
  els.uploadImageButton.disabled = true;
  els.imageStats.classList.add("hidden");
  els.previewPanel.classList.add("hidden");
  updatePreviewControls();
  els.imageState.className = "build-state";
  els.imageState.textContent = "未选择图片时，固件会显示默认几何测试图。";
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "-";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KiB`;
  }
  return `${bytes} B`;
}

function summarizeSelectedFiles() {
  if (!state.imageFiles.length) {
    els.selectedFilesLabel.textContent = "未选择素材";
    els.selectedFilesMeta.textContent = "支持 GIF、PNG、JPG、BMP、WebP";
    return;
  }

  const totalBytes = state.imageFiles.reduce((sum, file) => sum + (file.size || 0), 0);
  const firstName = state.imageFiles[0]?.name || "未命名";
  const isGif = state.imageFiles.length === 1 && /\.gif$/i.test(firstName);
  const typeText = isGif ? "GIF 动图" : state.imageFiles.length === 1 ? "单张图片" : "序列帧";

  els.selectedFilesLabel.textContent = state.imageFiles.length === 1
    ? firstName
    : `${firstName} 等 ${state.imageFiles.length} 个文件`;
  els.selectedFilesMeta.textContent = state.sourceFrames.length
    ? `${typeText} · ${state.sourceFrames.length} 帧源素材 · ${formatBytes(totalBytes)}`
    : `${typeText} · ${formatBytes(totalBytes)}`;
}

function profileFrameBytes() {
  if (!state.selectedProfile) {
    return 0;
  }
  return state.selectedProfile.logicalResolution.width * state.selectedProfile.logicalResolution.height * 2;
}

function maxFramesForCurrentProfile() {
  const frameBytes = profileFrameBytes();
  if (!frameBytes) {
    return 0;
  }
  return Math.min(MAX_IMAGE_FRAMES, Math.floor(MAX_IMAGE_RAW_BYTES / frameBytes));
}

function updateImageStats(frameCount = state.previewFrames.length) {
  if (!state.selectedProfile || !state.sourceFrames.length || !frameCount) {
    els.imageStats.classList.add("hidden");
    return;
  }

  const frameBytes = profileFrameBytes();
  const rawBytes = frameBytes * frameCount;
  const freeBytes = Math.max(MAX_IMAGE_RAW_BYTES - rawBytes, 0);
  els.sourceFrameCount.textContent = `${state.sourceFrames.length} 帧`;
  els.selectedFrameCount.textContent = `${frameCount} 帧`;
  els.imageRawSize.textContent = formatBytes(rawBytes);
  els.imageRawFree.textContent = formatBytes(freeBytes);
  els.profileMaxFrames.textContent = `${maxFramesForCurrentProfile()} 帧`;
  els.imageStats.classList.remove("hidden");
}

function rgb565ToHex(color) {
  const red5 = (color >> 11) & 0x1F;
  const green6 = (color >> 5) & 0x3F;
  const blue5 = color & 0x1F;
  const red8 = (red5 << 3) | (red5 >> 2);
  const green8 = (green6 << 2) | (green6 >> 4);
  const blue8 = (blue5 << 3) | (blue5 >> 2);
  return `#${[red8, green8, blue8].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeColorInput(value) {
  const text = value.trim();
  const rgb565Match = text.match(/^(0x)?([0-9a-fA-F]{4})$/);
  if (rgb565Match) {
    return rgb565ToHex(parseInt(rgb565Match[2], 16));
  }

  const rgb888Match = text.match(/^#?([0-9a-fA-F]{6})$/);
  if (rgb888Match) {
    return `#${rgb888Match[1]}`;
  }

  return null;
}

function syncBackgroundFromColorPicker() {
  els.imageBgText.value = els.imageBgColor.value;
  els.imageBgText.classList.remove("invalid");
  refreshPreparedImage();
}

function syncBackgroundFromText() {
  const color = normalizeColorInput(els.imageBgText.value);
  if (!color) {
    els.imageBgText.classList.toggle("invalid", els.imageBgText.value.trim() !== "");
    return;
  }

  els.imageBgColor.value = color;
  els.imageBgText.classList.remove("invalid");
  refreshPreparedImage();
}

function commitBackgroundText() {
  const color = normalizeColorInput(els.imageBgText.value);
  if (color) {
    els.imageBgColor.value = color;
    els.imageBgText.value = color;
  } else {
    els.imageBgText.value = els.imageBgColor.value;
  }
  els.imageBgText.classList.remove("invalid");
  refreshPreparedImage();
}

function drawCanvasWithFit(ctx, sourceCanvas, width, height) {
  const fitMode = els.imageFitMode.value;
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;

  if (fitMode === "stretch") {
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
    return;
  }

  const scale = Math.min(width / sourceWidth, height / sourceHeight, 1);
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
  const drawX = fitMode === "center" ? Math.round((width - drawWidth) / 2) : 0;
  const drawY = fitMode === "center" ? Math.round((height - drawHeight) / 2) : 0;
  ctx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);
}

function rotatedCanvas(sourceCanvas) {
  const rotation = parseInt(els.imageRotation.value, 10) || 0;
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  if (normalizedRotation === 0) {
    return sourceCanvas;
  }

  const canvas = document.createElement("canvas");
  const swapsAxes = normalizedRotation === 90 || normalizedRotation === 270;
  canvas.width = swapsAxes ? sourceCanvas.height : sourceCanvas.width;
  canvas.height = swapsAxes ? sourceCanvas.width : sourceCanvas.height;
  const ctx = canvas.getContext("2d");

  if (normalizedRotation === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (normalizedRotation === 180) {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
  } else if (normalizedRotation === 270) {
    ctx.translate(0, canvas.height);
    ctx.rotate((3 * Math.PI) / 2);
  }

  ctx.drawImage(sourceCanvas, 0, 0);
  return canvas;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}

function imageToCanvas(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  return canvas;
}

async function imageFileToFrame(file) {
  const image = await loadImage(file);
  return { canvas: imageToCanvas(image), delayMs: 100, name: file.name };
}

async function loadGifParser() {
  const globalParser = window.gifuct || window.gifuctJs || window.gifuctJS;
  if (typeof window.parseGIF === "function" && typeof window.decompressFrames === "function") {
    return { parseGIF: window.parseGIF, decompressFrames: window.decompressFrames };
  }
  if (globalParser && typeof globalParser.parseGIF === "function" && typeof globalParser.decompressFrames === "function") {
    return globalParser;
  }

  if (!state.gifParserPromise) {
    const moduleUrls = [
      "https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/+esm",
      "https://esm.sh/gifuct-js@2.1.2",
    ];
    state.gifParserPromise = (async () => {
      let lastError = null;
      for (const url of moduleUrls) {
        try {
          const module = await import(url);
          if (typeof module.parseGIF === "function" && typeof module.decompressFrames === "function") {
            return { parseGIF: module.parseGIF, decompressFrames: module.decompressFrames };
          }
        } catch (error) {
          lastError = error;
        }
      }
      throw new Error(`GIF 解析库加载失败：${lastError?.message || "无法访问 CDN"}`);
    })();
  }

  return state.gifParserPromise;
}

async function gifFileToFrames(file) {
  const { parseGIF, decompressFrames } = await loadGifParser();
  const buffer = await file.arrayBuffer();
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  let previousCanvas = null;

  return frames.map((frame, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = gif.lsd.width;
    canvas.height = gif.lsd.height;
    const ctx = canvas.getContext("2d");

    if (index > 0 && previousCanvas && frame.disposalType !== 2) {
      ctx.drawImage(previousCanvas, 0, 0);
    }

    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const imageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
    patchCanvas.getContext("2d").putImageData(imageData, 0, 0);
    ctx.drawImage(patchCanvas, frame.dims.left || 0, frame.dims.top || 0);

    previousCanvas = document.createElement("canvas");
    previousCanvas.width = canvas.width;
    previousCanvas.height = canvas.height;
    previousCanvas.getContext("2d").drawImage(canvas, 0, 0);

    return {
      canvas,
      delayMs: frame.delay || 100,
      name: `${file.name}#${index}`,
    };
  });
}

async function filesToFrames(files) {
  const selectedFiles = [...files];
  if (!selectedFiles.length) {
    return [];
  }

  if (selectedFiles.length === 1 && selectedFiles[0].name.toLowerCase().endsWith(".gif")) {
    return gifFileToFrames(selectedFiles[0]);
  }

  const sortedFiles = selectedFiles.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const frames = [];
  for (const file of sortedFiles) {
    frames.push(await imageFileToFrame(file));
  }
  return frames;
}

function limitFrames(frames) {
  const maxFrames = Math.max(1, Math.min(MAX_IMAGE_FRAMES, parseInt(els.imageMaxFrames.value, 10) || 20));
  els.imageMaxFrames.value = maxFrames;
  if (frames.length <= maxFrames || els.framePickMode.value === "first") {
    return frames.slice(0, maxFrames);
  }

  const picked = [];
  const lastIndex = frames.length - 1;
  const divisor = maxFrames - 1;
  for (let i = 0; i < maxFrames; i += 1) {
    const sourceIndex = divisor === 0 ? 0 : Math.round((i * lastIndex) / divisor);
    picked.push(frames[sourceIndex]);
  }
  return picked;
}

function framePickModeText() {
  return els.framePickMode.value === "first" ? "取前 N 帧" : "均匀抽帧";
}

function frameDelayMs() {
  const fps = Math.max(1, Math.min(30, parseInt(els.imageFps.value, 10) || 10));
  els.imageFps.value = fps;
  return Math.round(1000 / fps);
}

function drawPreparedFrame(sourceFrame, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = els.imageBgColor.value;
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawCanvasWithFit(ctx, rotatedCanvas(sourceFrame.canvas), width, height);
  return {
    canvas,
    name: sourceFrame.name,
  };
}

async function preparePreviewFrames() {
  if (!state.selectedProfile) {
    throw new Error("请先选择屏幕配置");
  }
  if (!state.sourceFrames.length) {
    throw new Error("请先选择图片、GIF 或序列帧");
  }

  const width = state.selectedProfile.logicalResolution.width;
  const height = state.selectedProfile.logicalResolution.height;
  const frames = limitFrames(state.sourceFrames);
  const frameBytes = width * height * 2;
  const totalBytes = frames.length * frameBytes;
  const maxBytes = MAX_IMAGE_RAW_BYTES;
  if (totalBytes > maxBytes) {
    const maxFramesForProfile = Math.max(1, Math.floor(maxBytes / frameBytes));
    throw new Error(`动画数据过大：${Math.round(totalBytes / 1024)}KB，当前屏幕最多约 ${maxFramesForProfile} 帧，请降低最大帧数或选择更小屏幕`);
  }

  const previewFrames = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    previewFrames.push(drawPreparedFrame(frames[frameIndex], width, height));
    if (frameIndex % 8 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return { width, height, frames: previewFrames };
}

function encodePreviewFrames(previewFrames, width, height) {
  const frameBytes = width * height * 2;
  const totalBytes = previewFrames.length * frameBytes;
  const rgb565Bytes = new Uint8Array(totalBytes);

  for (let frameIndex = 0; frameIndex < previewFrames.length; frameIndex += 1) {
    const ctx = previewFrames[frameIndex].canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, width, height);
    let byteOffset = frameIndex * frameBytes;
    for (let i = 0; i < imageData.data.length; i += 4, byteOffset += 2) {
      const red = imageData.data[i];
      const green = imageData.data[i + 1];
      const blue = imageData.data[i + 2];
      const rgb565 = ((red & 0xF8) << 8) | ((green & 0xF8) << 3) | (blue >> 3);
      rgb565Bytes[byteOffset] = rgb565 & 0xFF;
      rgb565Bytes[byteOffset + 1] = rgb565 >> 8;
    }
  }

  return rgb565Bytes;
}

async function prepareImagePayload() {
  const prepared = await preparePreviewFrames();
  const wasPlaying = state.previewPlaying;
  stopPreviewPlayback();
  state.previewFrames = prepared.frames;
  state.previewFrameIndex = Math.min(state.previewFrameIndex, Math.max(0, prepared.frames.length - 1));
  renderPreviewFrame();
  updatePreviewControls();
  updateImageStats(prepared.frames.length);

  if (wasPlaying && prepared.frames.length > 1) {
    startPreviewPlayback();
  }

  const rgb565Bytes = encodePreviewFrames(prepared.frames, prepared.width, prepared.height);
  return {
    profileId: state.selectedProfile.id,
    name: state.imageFiles.length === 1 ? state.imageFiles[0].name : `${state.imageFiles.length} files`,
    width: prepared.width,
    height: prepared.height,
    frameCount: prepared.frames.length,
    frameDelayMs: frameDelayMs(),
    pixelsRgb565Base64: bytesToBase64(rgb565Bytes),
  };
}

function renderPreviewFrame() {
  if (!state.previewFrames.length) {
    els.previewPanel.classList.add("hidden");
    return;
  }

  updatePreviewShape();
  const frame = state.previewFrames[state.previewFrameIndex];
  const previewCanvas = els.imagePreview;
  previewCanvas.width = frame.canvas.width;
  previewCanvas.height = frame.canvas.height;
  const ctx = previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  ctx.drawImage(frame.canvas, 0, 0);
  els.previewPanel.classList.remove("hidden");
  updatePreviewControls();
}

function updatePreviewShape() {
  const isRound = state.selectedProfile?.visibleArea?.shape === "round";
  els.previewPanel.classList.toggle("round-preview", isRound);
}

function updatePreviewControls() {
  const hasFrames = state.previewFrames.length > 0;
  const hasMultipleFrames = state.previewFrames.length > 1;
  els.prevFrameButton.disabled = !hasMultipleFrames;
  els.nextFrameButton.disabled = !hasMultipleFrames;
  els.playPreviewButton.disabled = !hasMultipleFrames;
  els.playPreviewButton.textContent = state.previewPlaying ? "暂停" : "播放";
  els.previewFrameSlider.disabled = !hasMultipleFrames;
  els.previewFrameSlider.min = hasFrames ? "1" : "0";
  els.previewFrameSlider.max = hasFrames ? String(state.previewFrames.length) : "0";
  els.previewFrameSlider.value = hasFrames ? String(state.previewFrameIndex + 1) : "0";
  els.previewFrameLabel.textContent = hasFrames
    ? `第 ${state.previewFrameIndex + 1} / ${state.previewFrames.length} 帧`
    : "-";
}

function stopPreviewPlayback() {
  if (state.previewTimer) {
    clearInterval(state.previewTimer);
  }
  state.previewTimer = null;
  state.previewPlaying = false;
  if (els.playPreviewButton) {
    updatePreviewControls();
  }
}

function startPreviewPlayback() {
  if (state.previewFrames.length <= 1) {
    return;
  }
  stopPreviewPlayback();
  state.previewPlaying = true;
  state.previewTimer = setInterval(() => {
    state.previewFrameIndex = (state.previewFrameIndex + 1) % state.previewFrames.length;
    renderPreviewFrame();
  }, frameDelayMs());
  updatePreviewControls();
}

function togglePreviewPlayback() {
  if (state.previewPlaying) {
    stopPreviewPlayback();
  } else {
    startPreviewPlayback();
  }
}

function stepPreviewFrame(delta) {
  if (!state.previewFrames.length) {
    return;
  }
  stopPreviewPlayback();
  const frameCount = state.previewFrames.length;
  state.previewFrameIndex = (state.previewFrameIndex + delta + frameCount) % frameCount;
  renderPreviewFrame();
}

function scrubPreviewFrame() {
  if (!state.previewFrames.length) {
    return;
  }
  stopPreviewPlayback();
  const nextIndex = Math.max(0, Math.min(state.previewFrames.length - 1, (parseInt(els.previewFrameSlider.value, 10) || 1) - 1));
  state.previewFrameIndex = nextIndex;
  renderPreviewFrame();
}

async function refreshPreparedImage() {
  if (!state.sourceFrames.length) {
    return;
  }

  els.uploadImageButton.disabled = true;
  els.imageState.className = "build-state";
  els.imageState.textContent = "正在重新生成屏幕尺寸预览...";

  try {
    state.imagePayload = await prepareImagePayload();
    els.imageState.className = "build-state success";
    els.imageState.textContent = `预览已更新：${state.imagePayload.width}x${state.imagePayload.height}，${state.imagePayload.frameCount} 帧，${framePickModeText()}，请重新上传后再生成。`;
    els.uploadImageButton.disabled = false;
    resetBuildResult();
  } catch (error) {
    state.imagePayload = null;
    els.imageStats.classList.add("hidden");
    els.imageState.className = "build-state error";
    els.imageState.textContent = error.message;
  }
}

async function handleImageFiles(files) {
  if (!files.length) {
    resetImageSelection();
    return;
  }

  els.uploadImageButton.disabled = true;
  els.imageState.className = "build-state";
  els.imageState.textContent = "正在生成屏幕尺寸预览...";

  try {
    state.imageFiles = files;
    summarizeSelectedFiles();
    state.sourceFrames = await filesToFrames(files);
    summarizeSelectedFiles();
    state.previewFrameIndex = 0;
    state.imagePayload = await prepareImagePayload();
    els.imageState.className = "build-state success";
    els.imageState.textContent = `已生成 ${state.imagePayload.width}x${state.imagePayload.height}、${state.imagePayload.frameCount} 帧，${framePickModeText()}，点击上传图片后再生成固件。`;
    els.uploadImageButton.disabled = false;
    resetBuildResult();
  } catch (error) {
    stopPreviewPlayback();
    state.imagePayload = null;
    state.imageFiles = [];
    state.sourceFrames = [];
    state.previewFrames = [];
    state.previewFrameIndex = 0;
    summarizeSelectedFiles();
    els.imageStats.classList.add("hidden");
    els.previewPanel.classList.add("hidden");
    updatePreviewControls();
    els.imageState.className = "build-state error";
    els.imageState.textContent = error.message;
  }
}

async function handleImageSelected() {
  await handleImageFiles([...(els.imageInput.files || [])]);
}

function setDropActive(isActive) {
  els.imageDropZone.classList.toggle("drag-active", isActive);
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  setDropActive(true);
}

function handleDragLeave(event) {
  if (!els.imageDropZone.contains(event.relatedTarget)) {
    setDropActive(false);
  }
}

async function handleImageDrop(event) {
  event.preventDefault();
  setDropActive(false);
  const files = [...(event.dataTransfer.files || [])].filter((file) => file.type.startsWith("image/"));
  if (!files.length) {
    els.imageState.className = "build-state error";
    els.imageState.textContent = "请拖入 GIF、PNG、JPG、BMP 或 WebP 图片文件。";
    return;
  }
  await handleImageFiles(files);
}

async function uploadSelectedImage() {
  if (!state.imagePayload) {
    return;
  }

  els.uploadImageButton.disabled = true;
  els.imageState.className = "build-state";
  els.imageState.textContent = "正在上传图片资源...";

  try {
    const result = await fetchJson("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.imagePayload),
    });
    resetBuildResult();
    els.imageState.className = "build-state success";
    els.imageState.textContent = `图片已上传：${result.image.name}，${result.image.frameCount || 1} 帧，下一次生成会编进固件。`;
  } catch (error) {
    els.uploadImageButton.disabled = false;
    els.imageState.className = "build-state error";
    els.imageState.textContent = `图片上传失败：${error.message}`;
  }
}

async function clearUploadedImage() {
  els.clearImageButton.disabled = true;
  try {
    await fetchJson("/api/image/clear", { method: "POST" });
    resetBuildResult();
    resetImageSelection();
    els.imageState.className = "build-state success";
    els.imageState.textContent = "图片资源已清除，下一次生成会恢复默认几何测试图。";
  } catch (error) {
    els.imageState.className = "build-state error";
    els.imageState.textContent = `清除失败：${error.message}`;
  } finally {
    els.clearImageButton.disabled = false;
  }
}

function renderProfiles() {
  els.profileList.innerHTML = "";
  for (const profile of state.registry.profiles) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-option";
    button.dataset.profileId = profile.id;
    button.innerHTML = `
      <strong>${profileResolution(profile)}</strong>
      <span>${profileShapeName(profile)}</span>
    `;
    button.addEventListener("click", () => selectProfile(profile.id));
    els.profileList.appendChild(button);
  }
}

function connectionClass(item) {
  if (item.gpio !== null && item.gpio !== undefined) {
    return "gpio";
  }
  if (/gnd/i.test(item.signal) || /GND/i.test(item.connectTo || "")) {
    return "gnd";
  }
  if (/vdd|leda/i.test(item.signal) || /3V3/i.test(item.connectTo || "")) {
    return "power";
  }
  if (/ledk/i.test(item.signal)) {
    return "backlight";
  }
  return "passive";
}

function localizedConnectTo(value) {
  const translations = {
    "Backlight cathode": "背光负极",
    "Backlight anode": "背光正极",
    "Not connected": "不连接",
  };
  return translations[value] || value || "-";
}

function localizedNote(value) {
  const translations = {
    "SPI MOSI": "SPI 数据输出",
    "SPI SCLK": "SPI 时钟",
    "LCD DC": "LCD 数据/命令选择",
    "Active-low reset": "低电平复位",
    "SPI chip select": "SPI 片选",
    "Common ground": "公共地",
    "LCD logic power": "LCD 逻辑电源",
    "Use current limiting or a backlight driver": "需要限流电阻或背光驱动",
    "Backlight positive": "背光正极",
    "Tearing-effect signal is unused": "撕裂同步信号未使用",
  };
  return translations[value] || value || "";
}

function localizedInterface(value) {
  const translations = {
    "4-wire SPI": "SPI 连接",
  };
  return translations[value] || value || "-";
}

function localizedVisibleArea(profile) {
  if (profile.visibleArea?.descriptionZh) {
    return profile.visibleArea.descriptionZh;
  }
  if (profile.visibleArea?.shape === "round") {
    return `${profile.logicalResolution.width} x ${profile.logicalResolution.height} 逻辑画面内的圆形可视区域，四角可能被裁切。`;
  }
  if (profile.visibleArea?.shape === "square") {
    return `完整显示 ${profile.logicalResolution.width} x ${profile.logicalResolution.height} 逻辑画面。`;
  }
  return profile.visibleArea?.shape || "-";
}

function profileShapeName(profile) {
  return profile.visibleArea?.shape === "round" ? "圆屏" : "方屏";
}

function profileResolution(profile) {
  return `${profile.logicalResolution.width}x${profile.logicalResolution.height}`;
}

function profileDisplayName(profile) {
  const moduleName = profile.module || profile.displayNameZh || profile.displayName || "";
  return `${profileResolution(profile)} ${profileShapeName(profile)}${moduleName ? ` · ${moduleName}` : ""}`;
}

function renderWiringDiagram(profile) {
  const rowHeight = 36;
  const top = 68;
  const height = top + profile.wiring.length * rowHeight + 28;
  const leftX = 162;
  const rightX = 548;
  const wireStartX = leftX + 78;
  const wireEndX = rightX - 78;
  const moduleTitle = profile.visibleArea?.shape === "round"
    ? `${profile.logicalResolution.width}x${profile.logicalResolution.height} 圆屏`
    : `${profile.logicalResolution.width}x${profile.logicalResolution.height} 方屏`;

  const rows = profile.wiring.map((item, index) => {
    const y = top + index * rowHeight;
    const pinLabel = `Pin ${item.fpcPin} ${item.signal}`;
    const targetLabel = localizedConnectTo(item.connectTo);
    const klass = connectionClass(item);
    return `
      <g class="wire-row ${klass}">
        <text x="${leftX}" y="${y}" class="pin-label" text-anchor="end">${pinLabel}</text>
        <circle cx="${wireStartX}" cy="${y - 4}" r="4"></circle>
        <path d="M ${wireStartX + 8} ${y - 4} C ${wireStartX + 92} ${y - 4}, ${wireEndX - 92} ${y - 4}, ${wireEndX - 8} ${y - 4}"></path>
        <circle cx="${wireEndX}" cy="${y - 4}" r="4"></circle>
        <text x="${rightX}" y="${y}" class="target-label">${targetLabel}</text>
      </g>
    `;
  }).join("");

  els.wiringDiagram.innerHTML = `
    <svg viewBox="0 0 720 ${height}" role="img" aria-label="${moduleTitle} 接线图">
      <rect x="32" y="20" width="176" height="${height - 40}" rx="8" class="diagram-device"></rect>
      <rect x="512" y="20" width="176" height="${height - 40}" rx="8" class="diagram-device"></rect>
      <text x="120" y="48" text-anchor="middle" class="diagram-title">${moduleTitle}</text>
      <text x="600" y="48" text-anchor="middle" class="diagram-title">ESP32-S3</text>
      ${rows}
    </svg>
  `;
}

function selectProfile(profileId) {
  const profile = state.registry.profiles.find((item) => item.id === profileId);
  if (!profile) {
    return;
  }

  state.selectedProfile = profile;
  resetBuildResult();
  resetImageSelection();
  updatePreviewShape();
  setStep("build");
  els.buildState.className = "build-state";
  els.buildState.textContent = "已选择屏幕，可以开始生成固件。";
  els.buildButton.disabled = false;

  document.querySelectorAll(".profile-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileId === profileId);
  });

  els.boardName.textContent = state.registry.board.name;
  els.driverIc.textContent = profile.driverIc;
  els.resolution.textContent = `${profile.logicalResolution.width} x ${profile.logicalResolution.height}`;
  els.interfaceName.textContent = localizedInterface(profile.interface);
  els.visibleArea.textContent = localizedVisibleArea(profile);
  els.currentProfileName.textContent = profileDisplayName(profile);
  renderWiringDiagram(profile);

  els.wiringBody.innerHTML = "";
  for (const item of profile.wiring) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.fpcPin}</td>
      <td>${item.signal}</td>
      <td>${localizedConnectTo(item.connectTo)}</td>
      <td>${localizedNote(item.note)}</td>
    `;
    els.wiringBody.appendChild(row);
  }

  const backlight = profile.backlight || {};
  const backlightRecommended = backlight.recommendedZh || backlight.recommended || "";
  const backlightSpec = backlight.specZh || backlight.spec || "";
  els.backlightNote.textContent = backlightSpec
    ? `${backlightRecommended} ${backlightSpec}`
    : backlightRecommended;
}

async function buildSelectedProfile() {
  if (!state.selectedProfile) {
    return;
  }

  setStep("build");
  resetBuildResult();
  els.buildButton.disabled = true;
  els.buildState.className = "build-state";
  els.buildState.textContent = "正在生成固件...";

  try {
    const result = await fetchJson("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: state.selectedProfile.id }),
    });

    state.lastBuild = result;
    els.buildState.className = "build-state success";
    els.buildState.textContent = "固件已生成。点击右侧 Connect 按钮即可烧录。";
    setStep("flash");
    setBuildReady(true);
    const appBytes = result.size?.appBytes ?? 0;
    const partitionBytes = result.size?.appPartitionBytes ?? APP_PARTITION_BYTES;
    const freeBytes = result.size?.appFreeBytes ?? Math.max(partitionBytes - appBytes, 0);
    els.appSize.textContent = `${formatBytes(appBytes)} / ${formatBytes(partitionBytes)}`;
    els.appFree.textContent = `${formatBytes(freeBytes)} 剩余`;
    els.appBin.textContent = result.artifacts.appBin || "-";
    els.bootloaderBin.textContent = result.artifacts.bootloaderBin || "-";
    els.partitionTableBin.textContent = result.artifacts.partitionTableBin || "-";
    els.flashArgs.textContent = result.artifacts.flashArgs || "-";
    els.logTail.textContent = (result.logTail || []).join("\n");
    els.artifactPanel.classList.remove("hidden");
    const manifestUrl = `/api/artifacts/${state.selectedProfile.id}/manifest.json`;
    els.manifestLink.href = manifestUrl;
    els.manifestLink.textContent = manifestUrl;
    els.installButton.setAttribute("manifest", manifestUrl);
    updateSerialSupport();
  } catch (error) {
    setBuildReady(false);
    els.buildState.className = "build-state error";
    els.buildState.textContent = `生成失败：${error.message}`;
  } finally {
    els.buildButton.disabled = false;
  }
}

async function init() {
  try {
    updateSerialSupport();
    await fetchJson("/api/health");
    setServerStatus(true, "服务器在线");
    state.registry = await fetchJson("/api/profiles");
    renderProfiles();
    selectProfile(state.registry.profiles[0].id);
    ensureInstallButtonReady();
  } catch (error) {
    setServerStatus(false, "服务器异常");
    els.buildState.className = "build-state error";
    els.buildState.textContent = error.message;
  }
}

els.buildButton.addEventListener("click", buildSelectedProfile);
els.currentProfileToggle.addEventListener("click", toggleCurrentProfile);
els.wiringToggle.addEventListener("click", toggleWiringPanel);
els.imageInput.addEventListener("change", handleImageSelected);
els.imageDropZone.addEventListener("dragenter", handleDragOver);
els.imageDropZone.addEventListener("dragover", handleDragOver);
els.imageDropZone.addEventListener("dragleave", handleDragLeave);
els.imageDropZone.addEventListener("drop", handleImageDrop);
els.imageFitMode.addEventListener("change", refreshPreparedImage);
els.imageRotation.addEventListener("change", refreshPreparedImage);
els.imageBgColor.addEventListener("input", syncBackgroundFromColorPicker);
els.imageBgText.addEventListener("input", syncBackgroundFromText);
els.imageBgText.addEventListener("change", commitBackgroundText);
els.imageFps.addEventListener("change", refreshPreparedImage);
els.framePickMode.addEventListener("change", refreshPreparedImage);
els.imageMaxFrames.addEventListener("change", refreshPreparedImage);
els.previewFrameSlider.addEventListener("input", scrubPreviewFrame);
els.prevFrameButton.addEventListener("click", () => stepPreviewFrame(-1));
els.playPreviewButton.addEventListener("click", togglePreviewPlayback);
els.nextFrameButton.addEventListener("click", () => stepPreviewFrame(1));
els.uploadImageButton.addEventListener("click", uploadSelectedImage);
els.clearImageButton.addEventListener("click", clearUploadedImage);
els.reloadInstallButton.addEventListener("click", ensureInstallButtonReady);
summarizeSelectedFiles();
setCurrentProfileExpanded(false);
setWiringExpanded(false);
init();
