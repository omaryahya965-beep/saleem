// Speech reliability: filters transcription segments that are likely hallucinated (music, silence,
// ambient noise) and decides the clip's audio mode. Pure module (Edge Functions + Vitest).

import { normalizeArabic } from "./arabic.ts";

export type AudioMode = "speech" | "music_no_speech" | "no_audio";

/** Browser-side probe result stored on the submission (see frontend/src/lib/speech.ts). */
export interface AudioProbe {
  has_audio: boolean;
  verdict: "silent" | "speech_likely" | "no_speech_likely" | "uncertain";
  speech_score?: number;
}

/** A transcription segment with the confidence signals Whisper's verbose_json returns. */
export interface ScoredSegment {
  start: number;
  end: number;
  text: string;
  no_speech_prob?: number;
  avg_logprob?: number;
  compression_ratio?: number;
}

/**
 * Phrases transcription models invent on music/silence (YouTube outro and subtitle-credit lines,
 * music markers). Written in normalizeArabic() form (lowercase, no hamza seats).
 */
export const HALLUCINATION_PATTERNS: RegExp[] = [
  /شكرا (لكم )?(علي|على)? ?(المشاهده|المشاهدة|المتابعه|المتابعة)/,
  /شكرا للمشاهده|شكرا للمشاهدة/,
  /اشتركو?ا? (في|ف) (القناه|القناة)/,
  /لا تنسوا? (الاشتراك|الاشتراك في القناه|الاشتراك في القناة|تفعيل الجرس)/,
  /(ترجمه|ترجمة|تفريغ) (نانسي قنقر|موقع|اماره|امارة)/,
  /نانسي قنقر/,
  /^(ترجمه|ترجمة)[:\s]/,
  /subtitles? (by|from)/,
  /amara\.org/,
  /thank(s| you) for watching/,
  /(please )?subscribe/,
  /^\s*[\[(]?(موسيقي|موسيقى|music|applause|تصفيق|ضحك)[\])]?\s*$/,
  /^[\s♪♫.…\-–—]*$/,
];

export interface FilterOptions {
  /** Stricter thresholds when the browser probe suspected no speech. */
  strict?: boolean;
}

export interface FilterResult {
  kept: ScoredSegment[];
  dropped: { text: string; reason: "no_speech_prob" | "low_logprob" | "repetition" | "hallucination_phrase" | "empty" }[];
}

export function isHallucinationPhrase(text: string): boolean {
  const n = normalizeArabic(text).replace(/[«»"'.,!؟?،]/g, " ").replace(/\s+/g, " ").trim();
  return n.length === 0 || HALLUCINATION_PATTERNS.some((p) => p.test(n));
}

/** Drops unreliable segments. Thresholds follow Whisper's own no-speech heuristics. */
export function filterSegments(segments: ScoredSegment[], opts: FilterOptions = {}): FilterResult {
  const noSpeechMax = opts.strict ? 0.3 : 0.6;
  const logprobMin = opts.strict ? -0.6 : -1.0;
  const kept: ScoredSegment[] = [];
  const dropped: FilterResult["dropped"] = [];
  for (const s of segments) {
    const text = s.text.trim();
    if (!text) {
      dropped.push({ text, reason: "empty" });
      continue;
    }
    if (isHallucinationPhrase(text)) {
      dropped.push({ text, reason: "hallucination_phrase" });
      continue;
    }
    // Whisper's rule: no_speech_prob high AND avg_logprob low → silence/music.
    if (s.no_speech_prob !== undefined && s.avg_logprob !== undefined && s.no_speech_prob > noSpeechMax && s.avg_logprob < -0.5) {
      dropped.push({ text, reason: "no_speech_prob" });
      continue;
    }
    if (s.avg_logprob !== undefined && s.avg_logprob < logprobMin) {
      dropped.push({ text, reason: "low_logprob" });
      continue;
    }
    if (s.compression_ratio !== undefined && s.compression_ratio > 2.4) {
      dropped.push({ text, reason: "repetition" });
      continue;
    }
    kept.push(s);
  }
  return { kept, dropped };
}

/** Final audio mode from the stream probe and what survived filtering. */
export function decideAudioMode(input: { hasAudioStream: boolean; kept: ScoredSegment[] }): AudioMode {
  if (!input.hasAudioStream) return "no_audio";
  const words = input.kept.reduce((n, s) => n + s.text.trim().split(/\s+/).filter(Boolean).length, 0);
  return words >= 2 ? "speech" : "music_no_speech";
}

/** Whether to call the transcription API at all. */
export function shouldTranscribe(probe: AudioProbe | null | undefined, hasAudioFile: boolean): boolean {
  if (!hasAudioFile) return false;
  if (!probe) return true; // older clients: transcribe and rely on the filter
  if (!probe.has_audio) return false;
  return probe.verdict !== "silent";
}
