// Cheap speech-presence probe on mono PCM (run in the browser before upload).
// Cues: frame energy (silence), syllabic modulation of the energy envelope (speech pulses at
// ~2–8 Hz), the share of short pauses, and zero-crossing variability (voiced/unvoiced alternation).
// It only decides whether transcription is worth calling and how strictly to filter it — the
// server makes the final audio-mode decision from the transcription's own confidence signals.

export type ProbeVerdict = "silent" | "speech_likely" | "no_speech_likely" | "uncertain";

export interface SpeechProbe {
  has_audio: boolean;
  verdict: ProbeVerdict;
  /** 0..1, higher = more speech-like. */
  speech_score: number;
  stats: {
    p95_db: number;
    modulation_ratio: number;
    pause_ratio: number;
    zcr_cv: number;
    active_ratio: number;
  };
}

const FRAME_S = 0.025;
const HOP_S = 0.01;
export const SILENCE_DB = -50;

const toDb = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return -120;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i]!;
}

/** Share of envelope modulation energy in the syllabic band (2–8 Hz) vs 0.5–16 Hz. */
function modulationRatio(env: number[], frameRate: number): number {
  const n = env.length;
  if (n < frameRate * 2) return 0;
  const mean = env.reduce((a, b) => a + b, 0) / n;
  const x = env.map((v) => v - mean);
  const power = (f: number) => {
    const w = (2 * Math.PI * f) / frameRate;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += x[i]! * Math.cos(w * i);
      im -= x[i]! * Math.sin(w * i);
    }
    return re * re + im * im;
  };
  let band = 0;
  let total = 0;
  for (let f = 0.5; f <= 16; f += 0.25) {
    const p = power(f);
    total += p;
    if (f >= 2 && f <= 8) band += p;
  }
  return total > 0 ? band / total : 0;
}

export function probeSpeech(samples: Float32Array, sampleRate: number): SpeechProbe {
  const frame = Math.round(FRAME_S * sampleRate);
  const hop = Math.round(HOP_S * sampleRate);
  const rmsDb: number[] = [];
  const env: number[] = [];
  const zcr: number[] = [];
  for (let start = 0; start + frame <= samples.length; start += hop) {
    let sum = 0;
    let crossings = 0;
    for (let i = start; i < start + frame; i++) {
      const s = samples[i]!;
      sum += s * s;
      if (i > start && Math.sign(s) !== Math.sign(samples[i - 1]!)) crossings++;
    }
    const rms = Math.sqrt(sum / frame);
    rmsDb.push(toDb(rms));
    env.push(rms);
    zcr.push(crossings / frame);
  }
  const sorted = [...rmsDb].sort((a, b) => a - b);
  const p95 = percentile(sorted, 95);
  const empty = { modulation_ratio: 0, pause_ratio: 0, zcr_cv: 0, active_ratio: 0 };
  if (!rmsDb.length || p95 < SILENCE_DB) {
    return {
      has_audio: true,
      verdict: "silent",
      speech_score: 0,
      stats: { p95_db: p95, ...empty },
    };
  }

  // Active = within 25 dB of the loud frames; pauses = short dips below that inside active regions.
  const activeThreshold = Math.max(p95 - 25, SILENCE_DB);
  const active = rmsDb.map((d) => d > activeThreshold);
  const activeRatio = active.filter(Boolean).length / active.length;
  const pauseThreshold = p95 - 15;
  const pauseRatio = rmsDb.filter((d) => d < pauseThreshold).length / rmsDb.length;

  const zActive = zcr.filter((_, i) => active[i]);
  const zMean = zActive.reduce((a, b) => a + b, 0) / Math.max(1, zActive.length);
  const zStd = Math.sqrt(
    zActive.reduce((a, b) => a + (b - zMean) ** 2, 0) / Math.max(1, zActive.length),
  );
  const zcrCv = zMean > 0 ? zStd / zMean : 0;

  const modRatio = modulationRatio(env, 1 / HOP_S);

  // Weighted evidence → 0..1. Thresholds calibrated on TTS speech vs synthesized music
  // (see frontend/src/test/speech.test.ts and docs/PROGRESS.md).
  const s1 = Math.min(1, Math.max(0, (modRatio - 0.25) / 0.35));
  const s2 = Math.min(1, Math.max(0, (pauseRatio - 0.05) / 0.25));
  const s3 = Math.min(1, Math.max(0, (zcrCv - 0.35) / 0.5));
  // Pauses and voiced/unvoiced alternation separate speech from music best; envelope modulation
  // alone is fooled by drum beats (calibration: TTS speech 0.75–0.79 → 0.89, synth music 0.40 → 0.18).
  const score = 0.2 * s1 + 0.4 * s2 + 0.4 * s3;
  // Gate: continuous sound without pauses is not conversational speech (calibrated speech had
  // 31–37 % pauses, music 0–2 %). Speech over non-stop music may land here too — that only
  // tightens the server-side confidence filter, it never skips transcription.
  const verdict: ProbeVerdict =
    pauseRatio < 0.08
      ? "no_speech_likely"
      : score >= 0.55
        ? "speech_likely"
        : score <= 0.3
          ? "no_speech_likely"
          : "uncertain";
  return {
    has_audio: true,
    verdict,
    speech_score: Math.round(score * 100) / 100,
    stats: {
      p95_db: Math.round(p95 * 10) / 10,
      modulation_ratio: Math.round(modRatio * 100) / 100,
      pause_ratio: Math.round(pauseRatio * 100) / 100,
      zcr_cv: Math.round(zcrCv * 100) / 100,
      active_ratio: Math.round(activeRatio * 100) / 100,
    },
  };
}

/** Probe for files with no decodable audio stream. */
export const NO_AUDIO_PROBE: SpeechProbe = {
  has_audio: false,
  verdict: "silent",
  speech_score: 0,
  stats: { p95_db: -120, modulation_ratio: 0, pause_ratio: 0, zcr_cv: 0, active_ratio: 0 },
};
