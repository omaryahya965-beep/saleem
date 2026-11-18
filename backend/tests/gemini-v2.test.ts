// PR #1 integration: Gemini on the v2 engine (analyzeV2). No network: the SDK call is injected via `generate`.
import { describe, expect, it } from "vitest";
import { GenerateContentResponse, type GenerateContentParameters } from "@google/genai";
import { GeminiAnalysis, GeminiTranscription, GEMINI_DEFAULT_MODEL, packFrames } from "../supabase/functions/_shared/providers/gemini.ts";
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

// D161 token savings: duplicate frames merged, frames packed by byte budget, honest coverage counts.
const jpeg = (fill: number) => `data:image/jpeg;base64,${Buffer.alloc(3000, fill).toString("base64")}`;
describe("Gemini frame packing (token savings)", () => {
  it("sends identical consecutive frames once, labelled with how long they stay on screen", async () => {
    const calls: GenerateContentParameters[] = [];
    const video = { ...sub, kind: "video" as const };
    const out = await provider(async (p) => { calls.push(p); return response(valid); }).analyzeV2({
      ...req(), submission: video, duration: 4,
      frames: [{ t: 0, url: jpeg(1) }, { t: 1, url: jpeg(1) }, { t: 2, url: jpeg(1) }, { t: 3, url: jpeg(2) }],
    });
    expect(calls).toHaveLength(1);
    const parts = (calls[0]!.contents as { parts: { text?: string; inlineData?: unknown }[] }[])[0]!.parts;
    expect(parts.filter((x) => x.inlineData)).toHaveLength(2);
    expect(parts.map((x) => x.text).join("|")).toContain("Frame at 0 seconds (unchanged on screen through 2 seconds)");
    expect(out.framesAnalyzed).toBe(4);
  });
  it("packs frames into as few requests as the inline budget allows", () => {
    const f = (t: number, size: number) => ({ t, until: t, part: {}, size });
    expect(packFrames([f(0, 4), f(1, 4), f(2, 4)], 10).map((b) => b.map((x) => x.t))).toEqual([[0, 1], [2]]);
    expect(packFrames(Array.from({ length: 60 }, (_, i) => f(i, 100_000))).length).toBe(1);
  });
  it("reports only frames from batches that validated", async () => {
    const video = { ...sub, kind: "video" as const };
    const out = await provider(async () => response({ bad: true })).analyzeV2({ ...req(), submission: video, duration: 2, frames: [{ t: 0, url: jpeg(1) }, { t: 1, url: jpeg(2) }] });
    expect(out.batchesFailed).toBe(1);
    expect(out.framesAnalyzed).toBe(0);
  });
});

describe("Gemini transcription media fallback", () => {
  it("accepts the original video container when the browser could not extract a WAV", async () => {
    const calls: GenerateContentParameters[] = [];
    const asr = new GeminiTranscription("test-key-not-a-real-credential", GEMINI_DEFAULT_MODEL, {
      generate: async (p: GenerateContentParameters) => { calls.push(p); return response({ segments: [{ start: 0, end: 2, text: "تمويل بدون رسوم" }], requires_human_review: false }); },
      sleep: async () => {},
    } as never);
    const out = await asr.transcribe(new Blob([new Uint8Array(100)], { type: "video/mp4" }), "ad.mp4");
    expect(out.segments).toEqual([{ start: 0, end: 2, text: "تمويل بدون رسوم" }]);
    expect(JSON.stringify(calls[0]!.contents)).toContain("video/mp4");
  });
  it("rejects media it cannot read as bad_request (the pipeline then marks transcription failed, not no-audio)", async () => {
    const asr = new GeminiTranscription("test-key-not-a-real-credential", GEMINI_DEFAULT_MODEL, { generate: async () => response({}) } as never);
    await expect(asr.transcribe(new Blob([new Uint8Array(10)], { type: "application/octet-stream" }), "x.bin")).rejects.toMatchObject({ info: { code: "bad_request" } });
  });
});
