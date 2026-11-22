// TEST-ONLY deterministic providers (D211). Enabled solely by SALEEM_TEST_PROVIDER=deterministic, which the isolated
// test stack (scripts/isolated-stack.mjs) sets and no deployed project does; refused when SUPABASE_URL is a hosted
// supabase.co project. No network call is made: transcription returns no speech (a transcript already stored for
// the version is reused by the pipeline) and the model step returns a valid, empty output, so only SALEEM's
// deterministic rule engine produces findings. Runs are recorded as model «deterministic-test», never as Gemini.
import type { AnalysisProvider, AnalysisRequestV2, AnalysisResult, AnalysisResultV2, TranscriptionProvider, TranscriptionResult } from "./types.ts";
import { ProviderError } from "./types.ts";

export const TEST_MODEL = "deterministic-test";

export function testProviderMode(env: (k: string) => string | undefined): boolean {
  if (env("SALEEM_TEST_PROVIDER") !== "deterministic") return false;
  return !/\.supabase\.co/i.test(env("SUPABASE_URL") ?? "");
}

export class DeterministicTranscription implements TranscriptionProvider {
  readonly name = "test";
  transcribe(): Promise<TranscriptionResult> {
    return Promise.resolve({ full_text: "", segments: [], scored: [], provider: "test", model: TEST_MODEL, seconds: 0 });
  }
}

export class DeterministicAnalysis implements AnalysisProvider {
  readonly name = "test";
  analyze(): Promise<AnalysisResult> {
    return Promise.reject(new ProviderError("the v1 analysis path is not available in test mode", false));
  }
  analyzeV2(req: AnalysisRequestV2): Promise<AnalysisResultV2> {
    return Promise.resolve({
      output: {
        schema_version: 2,
        classification: { is_advertisement: "unclear", language: "ar", detected_product_type: null },
        signals: [],
        ocr: [],
        rule_results: [],
        findings: [],
      },
      batchesFailed: 0,
      batches: 1,
      framesAnalyzed: req.frames.length,
      provider: "test",
      model: TEST_MODEL,
      usage: { input_tokens: 0, output_tokens: 0 },
      raw: [],
      attempts: 0,
    });
  }
}
