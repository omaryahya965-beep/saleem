import { describe, expect, it, vi } from "vitest";
import { GenerateContentResponse, type GenerateContentParameters } from "@google/genai";
import { GeminiAnalysis, GeminiTranscription, GEMINI_DEFAULT_MODEL, geminiError } from "../supabase/functions/_shared/providers/gemini.ts";
import { analysisProvider, transcriptionProvider, config } from "../supabase/functions/_shared/providers/index.ts";
import { SchemaError } from "../supabase/functions/_shared/pipeline/schema.ts";
import { reviewedStatus, reviewReasons, AUDIO_REVIEW } from "../supabase/functions/_shared/pipeline/review.ts";
import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../supabase/functions/_shared/pipeline/merge.ts";
import { audioCost, textCost } from "../supabase/functions/_shared/pipeline/cost.ts";
import type { AnalysisRequest } from "../supabase/functions/_shared/providers/types.ts";

const key = "test-key-not-a-real-credential";
const sleep = async () => {};
const request = (text = "#إعلان قهوة عربية بطعم الهيل"): AnalysisRequest => ({
  submission: { id: "test", is_demo: false, kind: "text", caption: "", text_content: text, platform: "snapchat", product_category: "other", is_paid_ad: true, has_written_contract: true, mawthooq_license_no: "TEST", ai_used: false, status: "analyzing", current_step: "llm", progress: 0 },
  segments: [], frames: [], duration: null,
  rules: [
    { code: "COM-01", category: "commerce", title_ar: "ادعاءات مضللة", title_en: "Misleading claims", description_ar: "", description_en: "", source_name: "Seed rulebook", source_url: "https://mc.gov.sa", check_type: "hybrid", default_severity: "violation", llm_instructions: "Identify absolute health or financial claims.", applies_to_categories: [] },
    { code: "MAW-01", category: "mawthooq", title_ar: "الإفصاح", title_en: "Disclosure", description_ar: "", description_en: "", source_name: "Seed rulebook", source_url: "https://www.mawthooq.sa", check_type: "hybrid", default_severity: "violation", llm_instructions: "Check ad disclosure.", applies_to_categories: [] },
  ],
});
const clean = () => ({ findings: [], on_screen_text: [], review_reasons: [] });
const finding = (evidence = "هذا الشاي ينحف خمسة كيلو في أسبوع") => ({
  rule_code: "COM-01", severity: "violation", t_start: null, t_end: null, evidence_type: "caption", evidence_text: evidence,
  explanation_ar: "ادعاء صحي مضمون النتيجة.", explanation_en: "Guaranteed health claim.",
  fix_ar: "احذف وعد النتيجة.", fix_en: "Remove the guaranteed result.", confidence: 0.95, requires_human_review: false,
});
function response(body: unknown, finishReason = "STOP") {
  return Object.assign(new GenerateContentResponse(), {
    candidates: [{ content: { role: "model", parts: [{ text: typeof body === "string" ? body : JSON.stringify(body) }] }, finishReason }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5, cachedContentTokenCount: 10 },
  }) as GenerateContentResponse;
}
const provider = (generate: (p: GenerateContentParameters) => Promise<GenerateContentResponse>, extra = {}) => new GeminiAnalysis(key, GEMINI_DEFAULT_MODEL, { generate, sleep, ...extra });

describe("Gemini provider selection", () => {
  it("uses Gemini for both stages by default and obeys GEMINI_MODEL", () => {
    expect(config(() => undefined)).toMatchObject({ llmProvider: "gemini", transcriptionProvider: "gemini", llmModel: GEMINI_DEFAULT_MODEL, transcriptionModel: GEMINI_DEFAULT_MODEL });
    expect(config((k) => ({ GEMINI_MODEL: "gemini-custom", LLM_MODEL: "stale-openai-model" })[k])).toMatchObject({ llmModel: "gemini-custom", transcriptionModel: "gemini-custom" });
  });
  it("fails explicitly when credentials are missing", () => {
    expect(() => analysisProvider(() => undefined)).toThrow("GEMINI_API_KEY");
    expect(() => transcriptionProvider(() => undefined)).toThrow("GEMINI_API_KEY");
    expect(() => new GeminiAnalysis("  ")).toThrow("GEMINI_API_KEY");
  });
  it("uses Gemini only: legacy LLM_PROVIDER/TRANSCRIPTION_PROVIDER=openai never selects OpenAI", () => {
    const legacy = (k: string) => ({ LLM_PROVIDER: "openai", TRANSCRIPTION_PROVIDER: "openai", OPENAI_API_KEY: "sk-legacy", GEMINI_API_KEY: key })[k];
    expect(analysisProvider(legacy).name).toBe("gemini");
    expect(transcriptionProvider(legacy).name).toBe("gemini");
    expect(config(legacy)).toMatchObject({ llmProvider: "gemini", transcriptionProvider: "gemini" });
    // An OpenAI key alone is not enough: Gemini is required and there is no fallback.
    expect(() => analysisProvider((k) => ({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-legacy" })[k])).toThrow("GEMINI_API_KEY");
  });
});

describe("Gemini structured compliance results (mocked transport)", () => {
  it("passes Arabic content, rule IDs and supplied sources to the SDK; returns a clean result", async () => {
    const generate = vi.fn(async (_request: GenerateContentParameters) => response(clean()));
    const result = await provider(generate).analyze(request());
    expect(result.findings).toEqual([]);
    expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 25, cached_input_tokens: 10 });
    expect(result.provider).toBe("gemini");
    const call = generate.mock.calls[0]![0];
    expect(call).toMatchObject({ model: GEMINI_DEFAULT_MODEL, config: { responseMimeType: "application/json", automaticContinuation: false } });
    expect(JSON.stringify(call.contents)).toContain("قهوة عربية");
    expect(JSON.stringify(call.contents)).toContain("https://mc.gov.sa");
    expect(call.config?.responseJsonSchema).toBeTruthy();
  });
  it("adapts a misleading claim to the existing findings model", async () => {
    const f = finding();
    const result = await provider(async () => response({ ...clean(), findings: [f] })).analyze(request(`#إعلان ${f.evidence_text}`));
    expect(result.findings[0]).toMatchObject({ rule_code: "COM-01", source: "llm", severity: "violation", evidence_text: f.evidence_text });
  });
  it("never accepts model-supplied regulatory reference fields into a finding", async () => {
    const f = { ...finding(), source_url: "https://untrusted.example/fabricated-law", source_name: "Invented regulator" };
    const result = await provider(async () => response({ ...clean(), findings: [f] })).analyze(request(f.evidence_text));
    expect(result.findings[0]).not.toHaveProperty("source_url");
    expect(result.findings[0]).not.toHaveProperty("source_name");
    expect(result.findings[0]?.rule_code).toBe("COM-01");
  });
  it.each(["MAW-01", "MAW-03", "MAW-04"])("rejects model findings for deterministic rule %s even with grounded quotes", async (code) => {
    const req = request(finding().evidence_text);
    req.rules.push({ ...req.rules[1]!, code });
    const generate = vi.fn(async () => response({ ...clean(), findings: [{ ...finding(), rule_code: code }] }));
    await expect(provider(generate).analyze(req)).rejects.toThrow("deterministic metadata rules");
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("combines multiple real rule findings with deterministic checks", async () => {
    const f = finding();
    const req = request(f.evidence_text);
    const result = await provider(async () => response({ ...clean(), findings: [f] })).analyze(req);
    const det = runDeterministicChecks(req.submission, [], result.on_screen_text);
    const merged = mergeAndFilterFindings([...det.findings, ...result.findings], new Set(req.rules.map((r) => r.code)));
    expect(merged.mergedFindings.map((f) => f.rule_code)).toEqual(expect.arrayContaining(["COM-01", "MAW-01"]));
    expect(merged.overallStatus).toBe("needs_fixes");
  });
  it("downgrades an uncertain interpretation and explicitly requests human review", async () => {
    const f = { ...finding(), requires_human_review: true };
    const result = await provider(async () => response({ ...clean(), findings: [f] })).analyze(request(f.evidence_text));
    expect(result.findings[0]?.severity).toBe("warning");
    expect(result.findings[0]?.explanation_ar).toContain("مراجعة بشرية");
  });
  it("preserves uncertainty even with no findings", async () => {
    const result = await provider(async () => response({ ...clean(), review_reasons: [AUDIO_REVIEW] })).analyze(request());
    expect(reviewedStatus("ready", result.review_reasons!)).toBe("review");
    expect(reviewedStatus("needs_fixes", result.review_reasons!)).toBe("needs_fixes");
    expect(reviewReasons([AUDIO_REVIEW], [AUDIO_REVIEW])).toHaveLength(1);
  });
  it("enforces rulebook applicability and advisory severity independently of the model", async () => {
    const req = request(finding().evidence_text);
    req.rules[0]!.default_severity = "warning";
    const generate = async () => response({ ...clean(), findings: [finding()] });
    expect((await provider(generate).analyze(req)).findings[0]?.severity).toBe("warning");
    req.rules[0]!.applies_to_categories = ["finance"];
    await expect(provider(generate).analyze(req)).rejects.toThrow("product category");
  });
  it("marks a video with no frames for human review", async () => {
    const req = request(); req.submission.kind = "video"; req.duration = 20;
    const result = await provider(async () => response(clean())).analyze(req);
    expect(result.review_reasons?.[0]?.ar).toContain("بشرياً");
  });
  it.each([
    ["invalid JSON", "not JSON"],
    ["missing schema fields", { findings: [] }],
    ["unknown rule", { ...clean(), findings: [{ ...finding(), rule_code: "INVENTED-99" }] }],
    ["invented quote", { ...clean(), findings: [finding("نص غير موجود")] }],
    ["invented frame", { ...clean(), findings: [{ ...finding(), evidence_type: "frame", t_start: 4 }] }],
    ["invented OCR", { ...clean(), on_screen_text: [{ t: 0, text: "مضمون" }] }],
    ["missing review flag", { ...clean(), findings: [{ ...finding(), requires_human_review: undefined }] }],
    ["invented metadata", { ...clean(), findings: [{ ...finding(), evidence_type: "metadata" }] }],
    ["invalid review notice", { ...clean(), review_reasons: [{ ar: "", en: "" }] }],
  ])("rejects %s instead of returning fake success", async (_, body) => {
    const generate = vi.fn(async (_request: GenerateContentParameters) => response(body));
    await expect(provider(generate).analyze(request(finding().evidence_text))).rejects.toBeInstanceOf(SchemaError);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("rejects safety-blocked and truncated responses", async () => {
    await expect(provider(async () => response(clean(), "SAFETY")).analyze(request())).rejects.toBeInstanceOf(SchemaError);
    await expect(provider(async () => response(clean(), "MAX_TOKENS")).analyze(request())).rejects.toBeInstanceOf(SchemaError);
  });
  it("gives one bounded corrective retry without weakening evidence validation", async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce(response({ ...clean(), findings: [finding("")] }))
      .mockResolvedValueOnce(response(clean()));
    const result = await provider(generate).analyze(request());
    expect(result.attempts).toBe(2);
    expect(result.findings).toEqual([]);
    const retry = JSON.stringify(generate.mock.calls[1]![0].contents);
    expect(retry).toContain("Finding lacks evidence");
    expect(retry).toContain("Do not invent evidence");
  });
  it("sends actual image bytes with frame timestamps", async () => {
    const generate = vi.fn(async (_request: GenerateContentParameters) => response({ ...clean(), on_screen_text: [{ t: 3, text: "إعلان" }] }));
    const req = request(); req.submission.kind = "image"; req.frames = [{ t: 3, url: "data:image/jpeg;base64,/9j/2Q==" }];
    expect((await provider(generate).analyze(req)).on_screen_text).toEqual([{ t: 3, text: "إعلان" }]);
    expect(JSON.stringify(generate.mock.calls[0]![0].contents)).toContain('"inlineData":{"mimeType":"image/jpeg","data":"/9j/2Q=="}');
  });
  it("grounds transcript quotes and timestamps in an actual supplied segment", async () => {
    const req = request(); req.submission.kind = "video"; req.duration = 20;
    req.segments = [{ start: 5, end: 9, text: finding().evidence_text }];
    const f = { ...finding(), evidence_type: "transcript", t_start: 5, t_end: 9 };
    expect((await provider(async () => response({ ...clean(), findings: [f] })).analyze(req)).findings[0]?.t_start).toBe(5);
    await expect(provider(async () => response({ ...clean(), findings: [{ ...f, t_start: 12 }] })).analyze(req)).rejects.toBeInstanceOf(SchemaError);
  });
  it("batches video frames within the inline budget and aggregates all validated results", async () => {
    const req = request(); req.submission.kind = "video"; req.duration = 20;
    req.frames = Array.from({ length: 17 }, (_, t) => ({ t, url: "data:image/jpeg;base64,/9j/2Q==" }));
    const generate = vi.fn(async (_request: GenerateContentParameters) => response(clean()));
    const result = await provider(generate).analyze(req);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.usage.input_tokens).toBe(200);
    expect(result.raw).toHaveLength(2);
  });
  it("does not return a partial successful report when a later video batch fails", async () => {
    const req = request(); req.submission.kind = "video"; req.duration = 20;
    req.frames = Array.from({ length: 17 }, (_, t) => ({ t, url: "data:image/jpeg;base64,/9j/2Q==" }));
    const generate = vi.fn().mockResolvedValueOnce(response(clean())).mockRejectedValue({ status: 503 });
    await expect(provider(generate).analyze(req)).rejects.toMatchObject({ info: { code: "overloaded" } });
    // batch 1 succeeds; batch 2: 1 request + 3 overload backoff retries + 1 ordinary retry, then fails as a whole
    expect(generate).toHaveBeenCalledTimes(6);
  });
  it("supports local storage only when its exact origin is configured server-side", async () => {
    const req = request(); req.submission.kind = "image";
    req.frames = [{ t: 0, url: "http://kong:8000/storage/v1/object/sign/media/a.jpg?token=private" }];
    const generate = vi.fn(async (_request: GenerateContentParameters) => response(clean()));
    const fetcher = vi.fn(async () => new Response(new Uint8Array([255, 216, 255, 217]), { headers: { "content-type": "image/jpeg" } }));
    await expect(provider(generate, { fetch: fetcher, storageUrl: "http://kong:8000" }).analyze(req)).resolves.toMatchObject({ provider: "gemini" });
    await expect(provider(generate, { fetch: fetcher, storageUrl: "http://other:8000" }).analyze(req)).rejects.toThrow("signed HTTPS");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds video length, image types, frame counts and input text before generation", async () => {
    const generate = vi.fn();
    const req = request(); req.duration = 100;
    await expect(provider(generate).analyze(req)).rejects.toThrow("90 second");
    req.duration = null; req.frames = [{ t: 0, url: "data:application/pdf;base64,AA==" }];
    await expect(provider(generate).analyze(req)).rejects.toThrow("Unsupported");
    req.frames = Array.from({ length: 63 }, () => ({ t: 0, url: "" }));
    await expect(provider(generate).analyze(req)).rejects.toThrow("frame");
    await expect(provider(generate).analyze(request("x".repeat(100_001)))).rejects.toThrow("prompt limit");
    expect(generate).not.toHaveBeenCalled();
  });
  it("rejects arbitrary URL paths, non-HTTPS frames and oversized downloads", async () => {
    const req = request();
    for (const url of ["http://127.0.0.1/file", "https://example.com/untrusted.jpg"]) {
      req.frames = [{ t: 0, url }];
      await expect(provider(vi.fn()).analyze(req)).rejects.toThrow("signed HTTPS");
    }
    req.frames = [{ t: 0, url: "https://example.supabase.co/storage/v1/object/sign/media/a.jpg?token=private" }];
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("large", { headers: { "content-type": "image/jpeg", "content-length": "9000000" } }));
    await expect(provider(vi.fn(), { fetch: fetcher }).analyze(req)).rejects.toThrow("size limit");
    expect(fetcher.mock.calls[0]![1]).toMatchObject({ redirect: "error" });
  });
});

describe("Gemini transport failures", () => {
  it("exhausts persistent 503s after bounded exponential backoff (3 s, 8 s, 15 s) and one ordinary retry", async () => {
    const generate = vi.fn().mockRejectedValue({ status: 503, message: "High demand" });
    const pause = vi.fn(async (_ms: number) => {});
    await expect(provider(generate, { sleep: pause }).analyze(request())).rejects.toMatchObject({
      status: 503, retryable: true, info: { code: "overloaded" },
    });
    expect(generate).toHaveBeenCalledTimes(5);
    const waits = pause.mock.calls.map((c) => c[0]);
    expect(waits).toHaveLength(4);
    expect(waits[0]).toBeGreaterThanOrEqual(3000); expect(waits[0]).toBeLessThan(3500);
    expect(waits[1]).toBeGreaterThanOrEqual(8000); expect(waits[1]).toBeLessThan(8500);
    expect(waits[2]).toBeGreaterThanOrEqual(15000); expect(waits[2]).toBeLessThan(15500);
    expect(waits[3]).toBeGreaterThanOrEqual(800); expect(waits[3]).toBeLessThan(1050);
  });
  it.each([429, 500, 503])("retries transient HTTP %s and counts the successful usage", async (status) => {
    const generate = vi.fn().mockRejectedValueOnce({ status, message: "provider failure" }).mockResolvedValue(response(clean()));
    expect((await provider(generate).analyze(request())).attempts).toBe(2);
  });
  it.each([400, 401, 403, 404])("does not retry permanent HTTP %s", async (status) => {
    const generate = vi.fn().mockRejectedValue({ status, message: "provider failure" });
    await expect(provider(generate).analyze(request())).rejects.toMatchObject({ status, retryable: false });
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("never propagates SDK exceptions containing credentials or signed URLs", async () => {
    const error = geminiError({ status: 400, message: "API key not valid: sensitive-key https://example.com?token=private" });
    expect(error.info?.code).toBe("invalid_key");
    expect(JSON.stringify(error)).not.toContain("sensitive-key");
    expect(error.message).not.toContain("token=");
    const generate = vi.fn().mockRejectedValue({ status: 503, message: "private content" });
    await expect(provider(generate).analyze(request())).rejects.toThrow("overloaded");
  });
  it.each([
    [400, "[400 Bad Request] API key expired. Please renew the API key. reason: API_KEY_INVALID", "invalid_key", false],
    [403, "PERMISSION_DENIED: Generative Language API has not been used in project", "no_access", false],
    [404, "models/gemini-x is not found for API version v1beta", "model_not_found", false],
    [400, "models/gemini-x is not supported for generateContent", "model_not_found", false],
    [429, "Quota exceeded for metric generate_content_free_tier_requests, limit: 0, per day. Check plan and billing", "insufficient_quota", false],
    [429, "RESOURCE_EXHAUSTED: Quota exceeded for metric: requests per minute per model", "rate_limited", true],
    [503, "The model is overloaded", "overloaded", true],
  ])("classifies Google HTTP %s errors precisely (%s)", (status, message, code, retryable) => {
    const error = geminiError({ status, message });
    expect(error.info?.code).toBe(code);
    expect(error.retryable).toBe(retryable);
  });
  it("times out even when a transport fails to honor its abort signal", async () => {
    const generate = vi.fn(() => new Promise<GenerateContentResponse>(() => {}));
    await expect(provider(generate, { timeoutMs: 5 }).analyze(request())).rejects.toMatchObject({ info: { code: "provider_down" } });
    // a timeout counts as overload: 1 request + 3 backoff retries + 1 ordinary retry, all bounded by the deadline
    expect(generate).toHaveBeenCalledTimes(5);
  });
});

describe("Gemini Arabic transcription", () => {
  const audio = new Blob([new Uint8Array(44)], { type: "audio/wav" });
  it("returns timed dialect speech and actual token usage without inventing Whisper confidence", async () => {
    const generate = vi.fn(async (_request: GenerateContentParameters) => response({ segments: [{ start: 0, end: 2, text: "هلا والله يا جماعة" }], requires_human_review: false }));
    const result = await new GeminiTranscription(key, GEMINI_DEFAULT_MODEL, { generate, sleep }).transcribe(audio, "test.wav");
    expect(result.scored).toEqual([{ start: 0, end: 2, text: "هلا والله يا جماعة" }]);
    expect(result.usage?.output_tokens).toBe(25);
    expect(result.requires_human_review).toBe(false);
  });
  it("returns explicit uncertainty or silence without fabricated transcript segments", async () => {
    const result = await new GeminiTranscription(key, GEMINI_DEFAULT_MODEL, { generate: async () => response({ segments: [], requires_human_review: true }), sleep }).transcribe(audio, "test.wav");
    expect(result.segments).toEqual([]);
    expect(result.requires_human_review).toBe(true);
  });
  it("rejects reversed/overlapping timestamps and invalid transcripts", async () => {
    const generate = async () => response({ segments: [{ start: 4, end: 2, text: "مرحبا" }], requires_human_review: false });
    await expect(new GeminiTranscription(key, GEMINI_DEFAULT_MODEL, { generate, sleep }).transcribe(audio, "test.wav")).rejects.toBeInstanceOf(SchemaError);
  });
  it("rejects oversized and unsupported files before the SDK call", async () => {
    const generate = vi.fn();
    const asr = new GeminiTranscription(key, GEMINI_DEFAULT_MODEL, { generate, sleep });
    await expect(asr.transcribe(new Blob(["%PDF"], { type: "application/pdf" }), "ad.pdf")).rejects.toThrow("Unsupported");
    await expect(asr.transcribe(new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: "audio/wav" }), "large.wav")).rejects.toThrow("8 MiB");
    expect(generate).not.toHaveBeenCalled();
  });
  it("estimates both stages from tokens rather than charging Gemini at Whisper's per-minute price", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 1_000_000 };
    expect(textCost(GEMINI_DEFAULT_MODEL, usage, undefined, new Date("2026-11-17"))).toBe(4.5);
    expect(textCost(GEMINI_DEFAULT_MODEL, usage, undefined, new Date("2027-01-01"))).toBe(9);
    expect(audioCost(GEMINI_DEFAULT_MODEL, 60)).toBe(0);
  });
});
