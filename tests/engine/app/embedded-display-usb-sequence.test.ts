import { describe, expect, test } from "bun:test";

import {
  encodeUsbSequenceFrame,
  encodeUsbSequenceFrames,
} from "@/features/embedded-display/adapters/usb-sequence";
import { encodeWirelessImage } from "@/features/embedded-display/adapters/wireless-content";
import type {
  EmbeddedDisplayProfile,
  EmbeddedImagePayload,
} from "@/features/embedded-display/model/types";

const profile = {
  id: "test-display",
  resolution: { width: 4, height: 1 },
} as EmbeddedDisplayProfile;

const patchProfile = {
  id: "patch-display",
  resolution: { width: 8, height: 8 },
} as EmbeddedDisplayProfile;

function singleImagePayload(): EmbeddedImagePayload {
  return {
    profileId: profile.id,
    name: "single",
    width: 4,
    height: 1,
    frameCount: 1,
    frameDelayMs: 1000,
    pixelsRgb565Base64: Buffer.from(new Uint8Array(8)).toString("base64"),
  };
}

function uniqueFrame(seed = 0): Uint8Array {
  const frame = new Uint8Array(8 * 8 * 2);
  for (let pixel = 0; pixel < 64; pixel += 1) {
    frame[pixel * 2] = (pixel + seed) & 0xff;
    frame[pixel * 2 + 1] = (pixel * 3 + seed) & 0xff;
  }
  return frame;
}

describe("USB PNG sequence content", () => {
  test("compresses flat RGB565 frames with RLE16", () => {
    const encoded = encodeUsbSequenceFrame(new Uint8Array(8));
    expect(encoded.codec).toBe(1);
    expect(encoded.bytes).toEqual(new Uint8Array([4, 0, 0, 0]));
  });

  test("allows more than 69 frames when compressed content fits", () => {
    const frames = Array.from({ length: 100 }, () => new Uint8Array(8));
    const sequence = encodeUsbSequenceFrames(profile, frames);
    const view = new DataView(sequence.content);
    expect(sequence.frameCount).toBe(100);
    expect(sequence.compressedFrames).toBe(1);
    expect(sequence.patchFrames).toBe(99);
    expect(view.getUint8(6)).toBe(2);
    expect(view.getUint16(12, true)).toBe(100);
    expect(view.getUint16(30, true)).toBe(100);
  });

  test("stores a small change as one absolute rectangle patch", () => {
    const first = uniqueFrame();
    const second = first.slice();
    for (let y = 3; y < 5; y += 1) {
      for (let x = 2; x < 4; x += 1) {
        const offset = (y * 8 + x) * 2;
        second[offset] = 0xaa;
        second[offset + 1] = 0x55;
      }
    }

    const sequence = encodeUsbSequenceFrames(patchProfile, [first, second]);
    const view = new DataView(sequence.content);
    const resourcesOffset = 24 + 12;
    const dataOffset = resourcesOffset + 2 * 12;
    const secondResourceOffset = resourcesOffset + 12;
    const secondDataOffset =
      dataOffset + view.getUint32(secondResourceOffset, true);

    expect(sequence.patchFrames).toBe(1);
    expect(view.getUint8(secondResourceOffset + 8)).toBe(2);
    expect(view.getUint16(secondDataOffset, true)).toBe(2);
    expect(view.getUint16(secondDataOffset + 2, true)).toBe(3);
    expect(view.getUint16(secondDataOffset + 4, true)).toBe(2);
    expect(view.getUint16(secondDataOffset + 6, true)).toBe(2);
    expect([0, 1]).toContain(view.getUint8(secondDataOffset + 8));
  });

  test("falls back to a full frame when the whole image changes", () => {
    const sequence = encodeUsbSequenceFrames(patchProfile, [
      uniqueFrame(),
      uniqueFrame(91),
    ]);
    const view = new DataView(sequence.content);
    const secondResourceOffset = 24 + 12 + 12;

    expect(sequence.patchFrames).toBe(0);
    expect([0, 1]).toContain(view.getUint8(secondResourceOffset + 8));
  });

  test("keeps the existing single-image format unchanged", () => {
    const encoded = encodeWirelessImage(singleImagePayload());
    const view = new DataView(encoded);
    expect(view.getUint8(6)).toBe(0);
    expect(view.getUint16(12, true)).toBe(1);
  });
});
