// Provider registry. SALEEM uses Google Gemini only (D161): analysis, vision and Arabic transcription.
// Configuration is server-side env only: GEMINI_API_KEY (required), GEMINI_MODEL and GEMINI_THINKING_LEVEL (optional).
// Legacy LLM_PROVIDER / TRANSCRIPTION_PROVIDER values (e.g. "openai") are ignored on purpose, so an old
// secret can never route an analysis to another provider. There is no fallback provider.

import { GeminiAnalysis, GeminiTranscription, GEMINI_DEFAULT_MODEL } from "./gemini.ts";
import { ProviderError, type AnalysisProvider, type TranscriptionProvider } from "./types.ts";

export type Env = (key: string) => string | undefined;

export const PROVIDER = "gemini" as const;

export function config(env: Env) {
  const model = env("GEMINI_MODEL")?.trim() || GEMINI_DEFAULT_MODEL;
  return {
    transcriptionProvider: PROVIDER,
    transcriptionModel: model,
    llmProvider: PROVIDER,
    llmModel: model,
  };
}

/** True when GEMINI_API_KEY holds something other than an empty value or an .env.example placeholder. */
export function hasGeminiKey(env: Env): boolean {
  const v = env("GEMINI_API_KEY")?.trim();
  return Boolean(v && !/^(your[_-]|<)/i.test(v));
}

function requireKey(env: Env): string {
  if (!hasGeminiKey(env)) {
    throw new ProviderError("GEMINI_API_KEY is not configured", false, undefined, {
      code: "missing_key",
      status: null,
      type: "missing_key",
      requestId: null,
      detail: "GEMINI_API_KEY is not configured in the server environment.",
    });
  }
  return env("GEMINI_API_KEY")!.trim();
}

export function transcriptionProvider(env: Env): TranscriptionProvider {
  return new GeminiTranscription(requireKey(env), config(env).transcriptionModel, { thinkingLevel: env("GEMINI_THINKING_LEVEL"), fallbackModel: env("GEMINI_FALLBACK_MODEL") });
}

export function analysisProvider(env: Env): AnalysisProvider {
  return new GeminiAnalysis(requireKey(env), config(env).llmModel, { storageUrl: env("SUPABASE_URL"), thinkingLevel: env("GEMINI_THINKING_LEVEL"), fallbackModel: env("GEMINI_FALLBACK_MODEL") });
}
