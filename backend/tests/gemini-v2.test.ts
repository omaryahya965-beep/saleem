// PR #1 integration: Gemini on the v2 engine (analyzeV2). No network: the SDK call is injected via `generate`.
import { describe, expect, it, vi } from "vitest";
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

describe("Gemini thinking level (latency and cost)", () => {
  const call = async (thinkingLevel?: string) => {
    const calls: GenerateContentParameters[] = [];
    await new GeminiAnalysis("test-key-not-a-real-credential", GEMINI_DEFAULT_MODEL, { generate: async (p: GenerateContentParameters) => { calls.push(p); return response(valid); }, sleep: async () => {}, thinkingLevel } as never).analyzeV2(req());
    return (calls[0]!.config as { thinkingConfig?: { thinkingLevel?: string } }).thinkingConfig?.thinkingLevel;
  };
  it("defaults to LOW, accepts a valid GEMINI_THINKING_LEVEL, and ignores invalid values", async () => {
    expect(await call()).toBe("LOW");
    expect(await call("high")).toBe("HIGH");
    expect(await call("minimal")).toBe("LOW");
  });
});

describe("Gemini overload fallback (GEMINI_FALLBACK_MODEL)", () => {
  const run = async (fail: { status: number; message: string }, fallbackModel?: string) => {
    const models: string[] = [];
    let first = true;
    const generate = async (p: GenerateContentParameters) => {
      models.push(p.model);
      if (first) { first = false; throw fail; }
      return response(valid);
    };
    const out = await new GeminiAnalysis("test-key-not-a-real-credential", "gemini-3.6-flash", { generate, sleep: async () => {}, fallbackModel } as never).analyzeV2(req());
    return { models, model: out.model };
  };
  it("switches to the fallback only on 503 and records the model that answered", async () => {
    expect(await run({ status: 503, message: "UNAVAILABLE: high demand" }, "gemini-3.1-flash-lite"))
      .toEqual({ models: ["gemini-3.6-flash", "gemini-3.1-flash-lite"], model: "gemini-3.1-flash-lite" });
  });
  it("also falls back when the primary does not answer in time, even after a first retry", async () => {
    const models: string[] = [];
    let calls = 0;
    const generate = async (p: GenerateContentParameters) => {
      models.push(p.model);
      calls++;
      if (calls === 1) throw { status: 500, message: "internal" };
      if (calls === 2) throw { message: "timeout" }; // no HTTP status, like an aborted request
      return response(valid);
    };
    const out = await new GeminiAnalysis("test-key-not-a-real-credential", "gemini-3.6-flash", { generate, sleep: async () => {}, fallbackModel: "gemini-3.1-flash-lite" } as never).analyzeV2(req());
    expect(models).toEqual(["gemini-3.6-flash", "gemini-3.6-flash", "gemini-3.1-flash-lite"]);
    expect(out.model).toBe("gemini-3.1-flash-lite");
  });
  it("without a fallback, a 503 retries the same model", async () => {
    expect(await run({ status: 503, message: "UNAVAILABLE" })).toEqual({ models: ["gemini-3.6-flash", "gemini-3.6-flash"], model: "gemini-3.6-flash" });
  });
  it("never falls back on other errors (rate limit retries the same model)", async () => {
    expect((await run({ status: 429, message: "RESOURCE_EXHAUSTED per minute" }, "gemini-3.1-flash-lite")).models).toEqual(["gemini-3.6-flash", "gemini-3.6-flash"]);
  });
});

// Regression (local demo, 2026-11-19 16:43 UTC): transcription failed after 3.6 Flash -> 503 and the fallback
// 3.1 Flash-Lite -> 503 within 17 s. Overload now gets bounded backoff retries alternating both models.
describe("Arabic transcription under Gemini overload", () => {
  const wav = () => new Blob([new Uint8Array(100)], { type: "audio/wav" });
  const ok = () => response({ segments: [{ start: 0, end: 2.5, text: "تمويل بدون رسوم" }], requires_human_review: false });
  const asr = (generate: (p: GenerateContentParameters) => Promise<GenerateContentResponse>, pause = async (_ms: number) => {}) =>
    new GeminiTranscription("test-key-not-a-real-credential", "gemini-3.6-flash", { generate, sleep: pause, fallbackModel: "gemini-3.1-flash-lite" } as never);
  it("recovers when both models answer 503 once: primary -> fallback -> (3 s) primary", async () => {
    const models: string[] = [];
    const pause = vi.fn(async (_ms: number) => {});
    let n = 0;
    const out = await asr(async (p) => { models.push(p.model); if (++n <= 2) throw { status: 503, message: "UNAVAILABLE high demand" }; return ok(); }, pause).transcribe(wav(), "a.wav");
    expect(models).toEqual(["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.6-flash"]);
    expect(out.segments).toEqual([{ start: 0, end: 2.5, text: "تمويل بدون رسوم" }]);
    expect(out.model).toBe("gemini-3.6-flash");
    expect(pause.mock.calls.map((c) => c[0])).toHaveLength(1);
    expect(pause.mock.calls[0]![0]).toBeGreaterThanOrEqual(3000);
  });
  it("records the fallback as the transcription model when it is the one that answered", async () => {
    let n = 0;
    const out = await asr(async () => { if (++n === 1) throw { status: 503, message: "UNAVAILABLE" }; return ok(); }).transcribe(wav(), "a.wav");
    expect(out.model).toBe("gemini-3.1-flash-lite");
  });
  it("an exhausted daily quota never switches model and fails as insufficient_quota (no retries)", async () => {
    const models: string[] = [];
    const quota = { status: 429, message: "Quota exceeded for metric generate_content_free_tier_requests, limit: 20, per day. Check your plan and billing details" };
    await expect(asr(async (p) => { models.push(p.model); throw quota; }).transcribe(wav(), "a.wav"))
      .rejects.toMatchObject({ retryable: false, info: { code: "insufficient_quota" } });
    expect(models).toEqual(["gemini-3.6-flash"]);
  });
  it("gives up after bounded retries with the overloaded code when Google stays overloaded", async () => {
    const models: string[] = [];
    await expect(asr(async (p) => { models.push(p.model); throw { status: 503, message: "UNAVAILABLE" }; }).transcribe(wav(), "a.wav"))
      .rejects.toMatchObject({ info: { code: "overloaded" } });
    expect(models).toEqual(["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-3.6-flash"]);
  });
});
