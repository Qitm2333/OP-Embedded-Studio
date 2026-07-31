import type { EmbeddedDisplayProfile } from "../model/types";
import { imageFileToRgb565 } from "./image";

const CONTENT_MAGIC = 0x4f504331;
const CONTENT_VERSION = 1;
const CONTENT_MODE_SEQUENCE = 2;
const CONTENT_HEADER_BYTES = 24;
const SEQUENCE_HEADER_BYTES = 12;
const SEQUENCE_RESOURCE_BYTES = 12;
const SEQUENCE_PATCH_HEADER_BYTES = 12;
const SEQUENCE_CODEC_RAW_RGB565 = 0;
const SEQUENCE_CODEC_RLE16 = 1;
const SEQUENCE_CODEC_PATCH_RGB565 = 2;
const USB_SEQUENCE_CONTENT_BYTES = 0x1cf0000;
const USB_SEQUENCE_FPS = 20;

export interface SequenceEncodingOptions {
  allowPatches?: boolean;
}

export interface UsbImageSequencePayload {
  profileId: string;
  name: string;
  width: number;
  height: number;
  frameCount: number;
  frameDelayMs: number;
  rawBytes: number;
  storedBytes: number;
  compressedFrames: number;
  patchFrames: number;
  content: ArrayBuffer;
}

interface EncodedFrame {
  codec: number;
  bytes: Uint8Array;
}

function bytesFromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function encodeUsbSequenceFrame(
  frame: Uint8Array,
): EncodedFrame {
  if (frame.byteLength % 2 !== 0) throw new Error("RGB565 帧长度必须为偶数");
  const rleBuffer = new Uint8Array(frame.byteLength * 2);
  let rleOffset = 0;
  for (let offset = 0; offset < frame.byteLength;) {
    const low = frame[offset];
    const high = frame[offset + 1];
    let run = 1;
    while (
      run < 0xffff &&
      offset + (run + 1) * 2 <= frame.byteLength &&
      frame[offset + run * 2] === low &&
      frame[offset + run * 2 + 1] === high
    ) {
      run += 1;
    }
    rleBuffer[rleOffset] = run & 0xff;
    rleBuffer[rleOffset + 1] = run >> 8;
    rleBuffer[rleOffset + 2] = low;
    rleBuffer[rleOffset + 3] = high;
    rleOffset += 4;
    offset += run * 2;
  }
  return rleOffset < frame.byteLength
    ? { codec: SEQUENCE_CODEC_RLE16, bytes: rleBuffer.slice(0, rleOffset) }
    : { codec: SEQUENCE_CODEC_RAW_RGB565, bytes: frame };
}

function encodeUsbSequencePatch(
  previous: Uint8Array,
  current: Uint8Array,
  width: number,
  height: number,
): EncodedFrame {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 2;
      if (
        previous[offset] === current[offset] &&
        previous[offset + 1] === current[offset + 1]
      ) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const unchanged = maxX < minX || maxY < minY;
  if (unchanged) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  const patchWidth = maxX - minX + 1;
  const patchHeight = maxY - minY + 1;
  const patchPixels = new Uint8Array(patchWidth * patchHeight * 2);
  for (let row = 0; row < patchHeight; row += 1) {
    const sourceOffset = ((minY + row) * width + minX) * 2;
    const destinationOffset = row * patchWidth * 2;
    patchPixels.set(
      current.subarray(sourceOffset, sourceOffset + patchWidth * 2),
      destinationOffset,
    );
  }

  const encodedPatch = encodeUsbSequenceFrame(patchPixels);
  const patchBytes = new Uint8Array(
    SEQUENCE_PATCH_HEADER_BYTES + encodedPatch.bytes.byteLength,
  );
  const patchView = new DataView(patchBytes.buffer);
  patchView.setUint16(0, minX, true);
  patchView.setUint16(2, minY, true);
  patchView.setUint16(4, patchWidth, true);
  patchView.setUint16(6, patchHeight, true);
  patchView.setUint8(8, encodedPatch.codec);
  patchBytes.set(encodedPatch.bytes, SEQUENCE_PATCH_HEADER_BYTES);

  const fullFrame = encodeUsbSequenceFrame(current);
  const patchArea = patchWidth * patchHeight;
  const frameArea = width * height;
  const patchHasSafeTransferArea = patchArea * 4 <= frameArea * 3;
  return unchanged ||
    (patchHasSafeTransferArea && patchBytes.byteLength < fullFrame.bytes.byteLength)
    ? { codec: SEQUENCE_CODEC_PATCH_RGB565, bytes: patchBytes }
    : fullFrame;
}

function encodeSequenceFrames(
  profile: EmbeddedDisplayProfile,
  frames: Uint8Array[],
  options: SequenceEncodingOptions,
): EncodedFrame[] {
  const frameBytes = profile.resolution.width * profile.resolution.height * 2;
  frames.forEach((frame) => {
    if (frame.byteLength !== frameBytes)
      throw new Error("PNG 序列帧尺寸不一致");
  });
  return frames.map((frame, index) =>
    index === 0 || options.allowPatches === false
      ? encodeUsbSequenceFrame(frame)
      : encodeUsbSequencePatch(
          frames[index - 1],
          frame,
          profile.resolution.width,
          profile.resolution.height,
        ),
  );
}

function buildUsbSequencePayload(
  profile: EmbeddedDisplayProfile,
  encodedFrames: EncodedFrame[],
  name: string,
): UsbImageSequencePayload {
  if (encodedFrames.length < 2) throw new Error("PNG 序列至少需要两张图片");
  if (encodedFrames.length > 0xffff)
    throw new Error("PNG 序列帧数超过格式限制");

  const frameBytes = profile.resolution.width * profile.resolution.height * 2;
  const dataBytes = encodedFrames.reduce(
    (total, frame) => total + frame.bytes.byteLength,
    0,
  );
  const payloadBytes =
    SEQUENCE_HEADER_BYTES +
    encodedFrames.length * SEQUENCE_RESOURCE_BYTES +
    dataBytes;
  const contentBytes = CONTENT_HEADER_BYTES + payloadBytes;
  if (contentBytes > USB_SEQUENCE_CONTENT_BYTES) {
    throw new Error(
      `PNG 序列压缩后为 ${(contentBytes / 1024 / 1024).toFixed(2)} MiB，超过 28.94 MiB 内容分区`,
    );
  }

  const payload = new Uint8Array(payloadBytes);
  const payloadView = new DataView(payload.buffer);
  payloadView.setUint32(0, frameBytes, true);
  payloadView.setUint16(4, Math.round(1000 / USB_SEQUENCE_FPS), true);
  payloadView.setUint16(6, encodedFrames.length, true);
  payloadView.setUint32(8, dataBytes, true);

  const dataOffset =
    SEQUENCE_HEADER_BYTES + encodedFrames.length * SEQUENCE_RESOURCE_BYTES;
  let storedOffset = 0;
  encodedFrames.forEach((frame, index) => {
    const resourceOffset =
      SEQUENCE_HEADER_BYTES + index * SEQUENCE_RESOURCE_BYTES;
    payloadView.setUint32(resourceOffset, storedOffset, true);
    payloadView.setUint32(resourceOffset + 4, frame.bytes.byteLength, true);
    payloadView.setUint8(resourceOffset + 8, frame.codec);
    payload.set(frame.bytes, dataOffset + storedOffset);
    storedOffset += frame.bytes.byteLength;
  });

  const content = new Uint8Array(contentBytes);
  const view = new DataView(content.buffer);
  view.setUint32(0, CONTENT_MAGIC, true);
  view.setUint16(4, CONTENT_VERSION, true);
  view.setUint8(6, CONTENT_MODE_SEQUENCE);
  view.setUint8(7, 0);
  view.setUint16(8, profile.resolution.width, true);
  view.setUint16(10, profile.resolution.height, true);
  view.setUint16(12, encodedFrames.length, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, payload.byteLength, true);
  view.setUint32(20, crc32(payload), true);
  content.set(payload, CONTENT_HEADER_BYTES);

  return {
    profileId: profile.id,
    name,
    width: profile.resolution.width,
    height: profile.resolution.height,
    frameCount: encodedFrames.length,
    frameDelayMs: Math.round(1000 / USB_SEQUENCE_FPS),
    rawBytes: frameBytes * encodedFrames.length,
    storedBytes: content.byteLength,
    compressedFrames: encodedFrames.filter(
      (frame) => frame.codec === SEQUENCE_CODEC_RLE16,
    ).length,
    patchFrames: encodedFrames.filter(
      (frame) => frame.codec === SEQUENCE_CODEC_PATCH_RGB565,
    ).length,
    content: content.buffer,
  };
}

export function encodeUsbSequenceFrames(
  profile: EmbeddedDisplayProfile,
  frames: Uint8Array[],
  name = "PNG sequence",
  options: SequenceEncodingOptions = {},
): UsbImageSequencePayload {
  return buildUsbSequencePayload(
    profile,
    encodeSequenceFrames(profile, frames, options),
    name,
  );
}

export async function imageFilesToUsbSequence(
  files: File[],
  profile: EmbeddedDisplayProfile,
  options: SequenceEncodingOptions = {},
): Promise<UsbImageSequencePayload> {
  if (files.length < 2) throw new Error("PNG 序列至少需要两张图片");
  if (
    files.some(
      (file) =>
        file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png"),
    )
  ) {
    throw new Error("PNG 序列只支持 PNG 文件");
  }

  const sortedFiles = [...files].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );
  const frames: Uint8Array[] = [];
  for (const file of sortedFiles) {
    const payload = await imageFileToRgb565(file, profile);
    frames.push(bytesFromBase64(payload.pixelsRgb565Base64));
  }
  return buildUsbSequencePayload(
    profile,
    encodeSequenceFrames(profile, frames, options),
    `${sortedFiles[0].name} 等 ${sortedFiles.length} 帧`,
  );
}
