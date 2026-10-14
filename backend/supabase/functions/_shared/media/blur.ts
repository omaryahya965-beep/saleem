// Privacy blur for evidence frames. Frames may show people (possibly minors), so every frame
// shown as evidence is irreversibly pixelated + box-blurred server-side before it is ever signed
// for the browser. The model sees the originals; users and the compliance log only see blurred copies.

/** Block size as a fraction of the shorter side: 1/12 makes faces unrecognizable at 768 px. */
export const BLUR_BLOCKS = 12;

/**
 * Pixelates an RGBA buffer in place (block averages); the original detail cannot be recovered.
 * Pure (no I/O) so it can be unit-tested; returns the same buffer.
 */
export function pixelateRgba(px: Uint8ClampedArray | Uint8Array, width: number, height: number, blocks = BLUR_BLOCKS) {
  const size = Math.max(4, Math.ceil(Math.min(width, height) / blocks));
  for (let by = 0; by < height; by += size) {
    for (let bx = 0; bx < width; bx += size) {
      const x1 = Math.min(width, bx + size), y1 = Math.min(height, by + size);
      const sum = [0, 0, 0, 0];
      let n = 0;
      for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
        const i = (y * width + x) * 4;
        sum[0] += px[i]; sum[1] += px[i + 1]; sum[2] += px[i + 2]; sum[3] += px[i + 3];
        n++;
      }
      const avg = sum.map((s) => Math.round(s / n));
      for (let y = by; y < y1; y++) for (let x = bx; x < x1; x++) {
        const i = (y * width + x) * 4;
        px[i] = avg[0]; px[i + 1] = avg[1]; px[i + 2] = avg[2]; px[i + 3] = avg[3];
      }
    }
  }
  return px;
}

/** Storage path for the blurred copy of a frame (originals stay private to the pipeline). */
export const evidencePath = (folder: string, frameId: string) => `${folder}/evidence/${frameId}.jpg`;
