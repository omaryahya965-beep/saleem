import { describe, expect, it } from "vitest";
import { NO_AUDIO_PROBE, probeSpeech } from "@/lib/speech";

const RATE = 16000;
const seconds = (s: number) => new Float32Array(Math.round(s * RATE));
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** Speech-like: ~4 syllables/s, voiced harmonics alternating with fricative noise, pauses between words. */
function speechLike(dur = 6) {
  const x = seconds(dur);
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    const word = Math.floor(t / 0.8);
    const inPause = t - word * 0.8 > 0.55; // ~30 % pauses
    if (inPause) continue;
    const syll = (t * 4) % 1;
    const voiced = syll < 0.6;
    const env = Math.sin(Math.PI * syll) ** 2;
    x[i] = voiced
      ? env * 0.4 * (Math.sin(2 * Math.PI * 140 * t) + 0.5 * Math.sin(2 * Math.PI * 280 * t))
      : env * 0.15 * rand();
  }
  return x;
}

/** Music-like: sustained chord + kick drum every 0.5 s, no pauses. */
function musicLike(dur = 6) {
  const x = seconds(dur);
  for (let i = 0; i < x.length; i++) {
    const t = i / RATE;
    const chord =
      0.12 *
      (Math.sin(2 * Math.PI * 220 * t) +
        Math.sin(2 * Math.PI * 277 * t) +
        Math.sin(2 * Math.PI * 330 * t));
    const kt = t % 0.5;
    const kick =
      kt < 0.15 ? 0.5 * Math.exp(-kt * 30) * Math.sin(2 * Math.PI * (120 - 400 * kt) * t) : 0;
    x[i] = chord + kick;
  }
  return x;
}

describe("probeSpeech", () => {
  it("flags digital silence and near-silence", () => {
    expect(probeSpeech(seconds(3), RATE).verdict).toBe("silent");
    const hiss = seconds(3).map(() => rand() * 0.001);
    expect(probeSpeech(hiss, RATE).verdict).toBe("silent");
  });
  it("recognises speech-like signals", () => {
    const r = probeSpeech(speechLike(), RATE);
    expect(r.verdict).toBe("speech_likely");
    expect(r.stats.pause_ratio).toBeGreaterThan(0.2);
  });
  it("does not call music speech", () => {
    const r = probeSpeech(musicLike(), RATE);
    expect(r.verdict).toBe("no_speech_likely");
    expect(r.stats.pause_ratio).toBeLessThan(0.1);
  });
  it("no-audio probe never triggers transcription", () => {
    expect(NO_AUDIO_PROBE).toMatchObject({ has_audio: false, verdict: "silent" });
  });
});
