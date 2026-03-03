#!/bin/bash
# Build CanvasKit with Graphite+WebGPU from Skia source
# Requires: git, python3, cmake, ninja
# Output: canvaskit.js + canvaskit.wasm in out/canvaskit_wasm/
set -euo pipefail

SKIA_DIR="${SKIA_DIR:-$HOME/Development/skia}"

if [ ! -d "$SKIA_DIR" ]; then
  echo "Cloning Skia..."
  git clone --depth 1 https://skia.googlesource.com/skia.git "$SKIA_DIR"
fi

cd "$SKIA_DIR"

echo "Syncing dependencies..."
python3 tools/git-sync-deps

echo "Activating emsdk..."
python3 bin/activate-emsdk

echo "Applying patches..."
PATCHES_DIR="$(cd "$(dirname "$0")" && pwd)"
git apply "$PATCHES_DIR/skia.patch" 2>/dev/null || true
(cd third_party/externals/dawn && git apply "$PATCHES_DIR/dawn-tint.patch" 2>/dev/null || true)

echo "Building CanvasKit with WebGPU..."
# CPATH may contain /opt/homebrew/include which leaks host headers into emscripten
unset CPATH C_INCLUDE_PATH CPLUS_INCLUDE_PATH
bash modules/canvaskit/compile.sh webgpu

echo "Done!"
ls -lh out/canvaskit_wasm/canvaskit.js out/canvaskit_wasm/canvaskit.wasm
