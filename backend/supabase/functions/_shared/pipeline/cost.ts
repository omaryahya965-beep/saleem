// Cost estimation from recorded usage. Prices are USD, from developers.openai.com/api/docs/pricing
// (checked 2026-10-14). Override per model with PRICE_<MODEL>="in,cached,out" (per 1M tokens) if prices change.

import type { TokenUsage } from "../types.ts";

export const TEXT_PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-6.1-sol": { input: 2.0, cached: 0.1, output: 10.0 },
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  "gpt-6-astra": { input: 10.0, cached: 1.0, output: 50.0 },
};

/** Per-minute transcription prices. */
export const AUDIO_PRICES_PER_MIN: Record<string, number> = {
  "gpt-4o-transcribe-diarize": 0.006,
  "whisper-1": 0.006,
  "gpt-transcribe": 0.0045,
  "gpt-4o-mini-transcribe": 0.003,
};

export function textCost(model: string, usage: TokenUsage, override?: string): number {
  let p = TEXT_PRICES[model];
  if (override) {
    const [input, cached, output] = override.split(",").map(Number);
    if ([input, cached, output].every((n) => Number.isFinite(n))) p = { input: input!, cached: cached!, output: output! };
  }
  if (!p) return 0;
  const cached = usage.cached_input_tokens ?? 0;
  const fresh = Math.max(0, usage.input_tokens - cached);
  return (fresh * p.input + cached * p.cached + usage.output_tokens * p.output) / 1_000_000;
}

export function audioCost(model: string, seconds: number): number {
  return ((AUDIO_PRICES_PER_MIN[model] ?? 0.006) * Math.max(0, seconds)) / 60;
}
