import { describe, expect, it } from "vitest";
import { encodeWavBuffer, frameTimes } from "@/lib/extract";

describe("frameTimes", () => {
  it("samples 1/s with first and last frame", () => {
    expect(frameTimes(5)).toEqual([0, 1, 2, 3, 4, 4.95]);
  });
  it("caps long clips at 60 samples + first/last", () => {
    const t = frameTimes(90);
    expect(t.length).toBeLessThanOrEqual(62);
    expect(t[0]).toBe(0);
    expect(t.at(-1)).toBeCloseTo(89.95, 2);
    expect([...t].sort((a, b) => a - b)).toEqual(t);
  });
  it("handles unknown duration", () => {
    expect(frameTimes(NaN)).toEqual([0]);
  });
});

describe("encodeWav", () => {
  it("writes a mono 16 kHz PCM16 header and clamps samples", () => {
    const v = new DataView(encodeWavBuffer(new Float32Array([0, 1, -1, 2]), 16000));
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(o + i)));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(40, true)).toBe(8);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
    expect(v.getInt16(50, true)).toBe(32767);
  });
});
