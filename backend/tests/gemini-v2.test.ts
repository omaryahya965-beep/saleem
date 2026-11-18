// PR #1 integration: Gemini on the v2 engine (analyzeV2). No network: the SDK call is injected via `generate`.
import { describe, expect, it } from "vitest";
import { GenerateContentResponse, type GenerateContentParameters } from "@google/genai";
import { GeminiAnalysis, GEMINI_DEFAULT_MODEL } from "../supabase/functions/_shared/providers/gemini.ts";
import { ANALYSIS_SCHEMA_V2 } from "../supabase/functions/_shared/pipeline/schema-v2.ts";
import { buildContext } from "../supabase/functions/_shared/pipeline/context.ts";
import { ProviderError } from "../supabase/functions/_shared/providers/types.ts";
import type { AnalysisRequestV2 } from "../supabase/functions/_shared/providers/types.ts";
import type { SubmissionData } from "../supabase/functions/_shared/types.ts";
import { releaseRules } from "../eval/rules-v2.ts";

const RULES = releaseRules().filter((r) => r.check_kind === "llm" || r.check_kind === "hybrid").slice(0, 5);
const sub: SubmissionData = {
  id: "s1", is_demo: false, kind: "text", caption: "", text_content: "تمويل شخصي بمعدل 3.9% فقط", platform: "x",
  product_category: "finance", is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: null,
  status: "analyzing", progress: 0, current_step: "llm",
};
const req = (): AnalysisRequestV2 => ({
  submission: sub,
  ctx: buildContext({ submission: sub, promotion: null, product: null, orgSettings: null, packs: [], orgPacks: [] }),
  segments: [], rules: RULES, frames: [], duration: null,
});
const valid = {
  schema_version: 2,
  classification: { is_advertisement: "yes", language: "ar", detected_product_type: null },
  signals: [], ocr: [], claims_detected: [],
  rule_results: RULES.map((r) => ({ rule_code: r.code, outcome: "passed", reason: "" })),
  findings: [],
};
const response = (body: unknown, finishReason = "STOP") =>
  Object.assign(new GenerateContentResponse(), {
    candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(body) }] }, finishReason }],
    usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 80, thoughtsTokenCount: 20, cachedContentTokenCount: 0 },
  }) as GenerateContentResponse;
const provider = (generate: (p: GenerateContentParameters) => Promise<GenerateContentResponse>) =>
  new GeminiAnalysis("test-key-not-a-real-credential", GEMINI_DEFAULT_MODEL, { generate, sleep: async () => {} } as never);

describe("Gemini analyzeV2 (v2 engine)", () => {
  it("sends the v2 schema and prompt, validates the answer and records token usage", async () => {
    const calls: GenerateContentParameters[] = [];
    const out = await provider(async (p) => (calls.push(p), response(valid))).analyzeV2(req());
    expect(calls).toHaveLength(1);
    expect((calls[0]!.config as { responseJsonSchema: unknown }).responseJsonSchema).toBe(ANALYSIS_SCHEMA_V2);
    expect(JSON.stringify(calls[0]!.contents)).toContain("3.9%");
    expect(out.output?.rule_results).toHaveLength(RULES.length);
    expect(out).toMatchObject({ provider: "gemini", model: GEMINI_DEFAULT_MODEL, batchesFailed: 0 });
    expect(out.usage.input_tokens).toBe(1200);
    expect(out.usage.output_tokens).toBe(100);
  });
  it("never invents a result: an answer that stays invalid marks the batch failed", async () => {
    const out = await provider(async () => response({ schema_version: 2, findings: "not a list" })).analyzeV2(req());
    expect(out.output).toBeNull();
    expect(out.batchesFailed).toBe(1);
  });
  it("an authentication failure fails the run with a provider error (no fake success)", async () => {
    const err = Object.assign(new Error("API key not valid. Please pass a valid API key."), { status: 400 });
    await expect(provider(async () => { throw err; }).analyzeV2(req())).rejects.toBeInstanceOf(ProviderError);
  });
});
