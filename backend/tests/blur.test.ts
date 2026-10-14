import { describe, expect, it } from "vitest";
import { evidencePath, pixelateRgba } from "../supabase/functions/_shared/media/blur.ts";

/** Checkerboard of 1-px black/white pixels: maximal detail, so any surviving detail is visible. */
function checker(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = (x + y) % 2 ? 255 : 0;
    px.set([v, v, v, 255], (y * w + x) * 4);
  }
  return px;
}

describe("evidence frame blur", () => {
  it("destroys fine detail (a face-scale pattern becomes flat blocks)", () => {
    const w = 96, h = 128;
    const px = pixelateRgba(checker(w, h), w, h);
    const block = Math.ceil(Math.min(w, h) / 12); // 8 px
    // Inside one block every pixel is identical.
    const at = (x: number, y: number) => px[(y * w + x) * 4];
    for (let y = 0; y < block; y++) for (let x = 0; x < block; x++) expect(at(x, y)).toBe(at(0, 0));
    // Adjacent pixels no longer alternate anywhere in the image.
    let edges = 0;
    for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) if (Math.abs(at(x, y) - at(x - 1, y)) > 40) edges++;
    expect(edges).toBe(0);
  });
  it("keeps the overall brightness and alpha", () => {
    const px = pixelateRgba(checker(48, 48), 48, 48);
    const mean = px.filter((_, i) => i % 4 === 0).reduce((a, b) => a + b, 0) / (48 * 48);
    expect(mean).toBeGreaterThan(120);
    expect(mean).toBeLessThan(135);
    expect(px[3]).toBe(255);
  });
  it("handles edges that are not a multiple of the block size", () => {
    expect(() => pixelateRgba(checker(37, 53), 37, 53)).not.toThrow();
  });
  it("blurred copies live outside the frames folder the model reads", () => {
    expect(evidencePath("u/s", "f1")).toBe("u/s/evidence/f1.jpg");
  });
});
