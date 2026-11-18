// Provider registry. Providers and models come from env only (see functions/.env.example).
// Google Gen AI and OpenAI share the production analysis/transcription interfaces.

import { OpenAIAnalysis, OpenAITranscription } from "./openai.ts";
import { GeminiAnalysis, GeminiTranscription, GEMINI_DEFAULT_MODEL } from "./gemini.ts";
import { ProviderError, type AnalysisProvider, type TranscriptionProvider } from "./types.ts";

export type Env = (key: string) => string | undefined;

export const DEFAULTS = {
  TRANSCRIPTION_PROVIDER: "gemini",
  TRANSCRIPTION_MODEL: "gemini-3.8-flash",
  LLM_PROVIDER: "gemini",
  LLM_MODEL: "gemini-3.8-flash",
  LLM_REASONING_EFFORT: "medium",
} as const;

export function config(env: Env) {
  // Gemini is the primary and default provider for SALEEM.
  const transcriptionProvider = env("TRANSCRIPTION_PROVIDER") || DEFAULTS.TRANSCRIPTION_PROVIDER;
  const llmProvider = env("LLM_PROVIDER") || DEFAULTS.LLM_PROVIDER;
  const geminiModel = env("GEMINI_MODEL") || GEMINI_DEFAULT_MODEL;
  return {
    transcriptionProvider,
    transcriptionModel: transcriptionProvider === "gemini" ? geminiModel : env("TRANSCRIPTION_MODEL") || "whisper-1",
    llmProvider,
    llmModel: llmProvider === "gemini" ? geminiModel : env("LLM_MODEL") || "gpt-6.1-sol",
    reasoningEffort: env("LLM_REASONING_EFFORT") || DEFAULTS.LLM_REASONING_EFFORT,
  };
}

class DisabledProvider implements TranscriptionProvider, AnalysisProvider {
  constructor(readonly name: string) {}
  transcribe(): never {
    throw new ProviderError(`${this.name} provider is not enabled (no API key configured)`, false);
  }
  analyze(): never {
    throw new ProviderError(`${this.name} provider is not enabled (no API key configured)`, false);
  }
  analyzeV2(): never {
    throw new ProviderError(`${this.name} provider is not enabled (no API key configured)`, false);
  }
}

function requireKey(env: Env, key: string): string {
  const v = env(key)?.trim();
  if (!v || v === "your-gemini-api-key" || v === "your-openai-api-key" || /^(your[_-]|sk-\.\.\.)/i.test(v)) {
    throw new ProviderError(`${key} is not configured`, false, undefined, {
      code: "missing_key",
      status: null,
      type: "missing_key",
      requestId: null,
      detail: `${key} is not configured in the server environment.`,
    });
  }
  return v;
}

export function transcriptionProvider(env: Env): TranscriptionProvider {
  const c = config(env);
  switch (c.transcriptionProvider) {
    case "openai":
      return new OpenAITranscription(requireKey(env, "OPENAI_API_KEY"), c.transcriptionModel);
    case "gemini":
      return new GeminiTranscription(requireKey(env, "GEMINI_API_KEY"), c.transcriptionModel);
    case "anthropic":
      return new DisabledProvider(c.transcriptionProvider);
    default:
      throw new ProviderError(`unknown TRANSCRIPTION_PROVIDER "${c.transcriptionProvider}"`, false);
  }
}

export function analysisProvider(env: Env): AnalysisProvider {
  const c = config(env);
  switch (c.llmProvider) {
    case "openai":
      return new OpenAIAnalysis(requireKey(env, "OPENAI_API_KEY"), c.llmModel, c.reasoningEffort);
    case "gemini":
      return new GeminiAnalysis(requireKey(env, "GEMINI_API_KEY"), c.llmModel, { storageUrl: env("SUPABASE_URL") });
    case "anthropic":
      return new DisabledProvider(c.llmProvider);
    default:
      throw new ProviderError(`unknown LLM_PROVIDER "${c.llmProvider}"`, false);
  }
}
