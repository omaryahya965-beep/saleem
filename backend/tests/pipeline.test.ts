// Unit tests for the analysis pipeline: Arabic deterministic checks, schema validation, merge, cost.
import { describe, expect, it } from "vitest";
import { normalizeArabic } from "../supabase/functions/_shared/rules/arabic.ts";
import { CLAIM_PATTERNS, DISCOUNT_CODE, runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings, overallStatusOf } from "../supabase/functions/_shared/pipeline/merge.ts";
import { SchemaError, parseModelJson, validateAnalysis } from "../supabase/functions/_shared/pipeline/schema.ts";
import { audioCost, textCost } from "../supabase/functions/_shared/pipeline/cost.ts";
import { normalizeSegments } from "../supabase/functions/_shared/providers/openai.ts";
import type { Finding, SubmissionData, TranscriptSegment } from "../supabase/functions/_shared/types.ts";

const sub = (over: Partial<SubmissionData> = {}): SubmissionData => ({
  id: "s1",
  is_demo: false,
  kind: "video",
  caption: "",
  platform: "snapchat",
  product_category: "health",
  is_paid_ad: false,
  has_written_contract: true,
  ai_used: false,
  mawthooq_license_no: "MW-1",
  status: "analyzing",
  progress: 0,
  current_step: "deterministic",
  ...over,
});
const seg = (start: number, text: string, end = start + 4): TranscriptSegment => ({ start, end, text });
const codes = (fs: Finding[]) => fs.map((f) => f.rule_code).sort();

describe("normalizeArabic", () => {
  it("strips diacritics/tatweel, unifies alef and ya, converts digits", () => {
    expect(normalizeArabic("إعـــلانٌ مدفُوع")).toBe("اعلان مدفوع");
    expect(normalizeArabic("تنزلين ٥ كيلو")).toBe("تنزلين 5 كيلو");
    expect(normalizeArabic("على  مستوى")).toBe("علي مستوي");
  });
});

describe("discount code regex", () => {
  it.each([
    ["استخدموا كود SALEEM20", "SALEEM20"],
    ["كوبون: NAKH15", "NAKH15"],
    ["code：ABC123", "ABC123"],
    ["خصم SAVE30 على كل الطلبات", "SAVE30"],
  ])("finds the code in %s", (text, code) => {
    expect(DISCOUNT_CODE.exec(text)?.[2]).toBe(code);
  });
  it("ignores Arabic words after 'خصم'", () => {
    expect(DISCOUNT_CODE.exec("خصم كبير اليوم")).toBeNull();
  });
});

describe("health/finance claim patterns", () => {
  const hit = (text: string) => CLAIM_PATTERNS.filter((c) => c.re.test(normalizeArabic(text))).map((c) => c.key);
  it.each([
    ["هذا الشاي ينحف بسرعة", "slimming"],
    ["تنزلين 5 كيلو في أسبوع", "weight_loss"],
    ["تنزل ٣ كيلو بدون رجيم", "weight_loss"],
    ["وتنزلين خمس كيلو في أسبوع", "weight_loss"],
    ["هالمنتج يعالج القولون", "cures"],
    ["علاج نهائي للصلع", "cures"],
    ["يشفي من الصداع", "cures"],
    ["النتيجة مضمونة ١٠٠٪", "guaranteed"],
    ["بدون أعراض جانبية أبداً", "no_side_effects"],
    ["ربح مضمون كل شهر", "guaranteed_profit"],
    ["عائد يومي ثابت", "daily_return"],
  ])("%s → %s", (text, key) => {
    expect(hit(text)).toContain(key);
  });
  it("does not flag neutral experience talk", () => {
    expect(hit("أحس فيه بالراحة بعد العشاء وهذي تجربتي الشخصية")).toEqual([]);
  });
});

describe("runDeterministicChecks", () => {
  it("flags MAW-01 when a paid ad has no disclosure in caption or first 5 s", () => {
    const r = runDeterministicChecks(sub({ is_paid_ad: true, caption: "جربت شاي جديد" }), [seg(0, "هلا والله يا جماعة")]);
    expect(codes(r.findings)).toContain("MAW-01");
    expect(r.findings.find((f) => f.rule_code === "MAW-01")?.severity).toBe("violation");
  });

  it("accepts #إعلان in the caption", () => {
    const r = runDeterministicChecks(sub({ is_paid_ad: true, caption: "#إعلان | تجربة شاي الأعشاب" }), []);
    expect(codes(r.findings)).not.toContain("MAW-01");
  });

  it("accepts a spoken disclosure in the first 5 s but not later", () => {
    const early = runDeterministicChecks(sub({ is_paid_ad: true }), [seg(1, "إعلان مدفوع بالتعاون مع متجر نخلة")]);
    expect(codes(early.findings)).not.toContain("MAW-01");
    const late = runDeterministicChecks(sub({ is_paid_ad: true }), [seg(0, "هلا"), seg(12, "ترى هذا إعلان")]);
    expect(codes(late.findings)).toContain("MAW-01");
  });

  it("accepts an on-screen disclosure in the first 5 s", () => {
    const r = runDeterministicChecks(sub({ is_paid_ad: true }), [], [{ t: 2, text: "إعلان" }]);
    expect(codes(r.findings)).not.toContain("MAW-01");
  });

  it("treats a discount code as promotional even if the paid flag is off", () => {
    const r = runDeterministicChecks(sub({ is_paid_ad: false }), [seg(24, "استخدموا كود SALEEM20 والرابط في البايو")]);
    expect(r.promotional).toBe(true);
    expect(r.discountCodes).toEqual(["SALEEM20"]);
    const maw = r.findings.find((f) => f.rule_code === "MAW-01");
    expect(maw?.evidence_text).toContain("SALEEM20");
  });

  it("flags COM-01 claims with timestamps, violation when promotional", () => {
    const r = runDeterministicChecks(sub({ is_paid_ad: true, caption: "#اعلان" }), [
      seg(12, "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع", 19),
      seg(19, "ومضمون بدون أعراض جانبية", 24),
    ]);
    const com = r.findings.filter((f) => f.rule_code === "COM-01");
    expect(com.map((f) => f.t_start)).toEqual([12, 19]);
    expect(com.every((f) => f.severity === "violation")).toBe(true);
  });

  it("COM-01 is only a warning in non-promotional content", () => {
    const r = runDeterministicChecks(sub(), [seg(3, "هالخلطة تشفي من كل شي")]);
    expect(r.findings.find((f) => f.rule_code === "COM-01")?.severity).toBe("warning");
  });

  it("reads claims from on-screen text and the text-only post body", () => {
    const fromOcr = runDeterministicChecks(sub(), [], [{ t: 8, text: "ربح مضمون 30٪" }]);
    expect(fromOcr.findings[0]).toMatchObject({ rule_code: "COM-01", evidence_type: "frame", t_start: 8 });
    const fromText = runDeterministicChecks(sub({ kind: "text", text_content: "عائد يومي مضمون للمستثمرين" }), []);
    expect(fromText.findings[0]).toMatchObject({ rule_code: "COM-01", evidence_type: "caption" });
  });

  it("raises metadata rules MAW-03 / MAW-04 only for promotional content", () => {
    const ad = runDeterministicChecks(sub({ is_paid_ad: true, caption: "#إعلان", has_written_contract: false, mawthooq_license_no: "" }), []);
    expect(codes(ad.findings)).toEqual(["MAW-03", "MAW-04"]);
    const organic = runDeterministicChecks(sub({ has_written_contract: false, mawthooq_license_no: "" }), [seg(0, "يومي في الرياض")]);
    expect(organic.findings).toEqual([]);
  });

  it("AI-01 requires an AI disclosure when ai_used is set", () => {
    expect(codes(runDeterministicChecks(sub({ ai_used: true }), []).findings)).toEqual(["AI-01"]);
    expect(runDeterministicChecks(sub({ ai_used: true, caption: "المحتوى معدّل بالذكاء الاصطناعي" }), []).findings).toEqual([]);
    expect(runDeterministicChecks(sub({ ai_used: true, caption: "#AI generated" }), []).findings).toEqual([]);
  });

  it("produces the expected set on the demo 'slimming tea' fixture", () => {
    const r = runDeterministicChecks(
      sub({ is_paid_ad: true, ai_used: true, has_written_contract: false, mawthooq_license_no: null, caption: "جربت شاي التنحيف الجديد 🔥 كود الخصم SALEEM20 الرابط في البايو" }),
      [
        seg(0, "هلا والله يا جماعة، اليوم بجرب لكم شاي جديد", 4.5),
        seg(4.5, "صراحة طعمه حلو وريحته تجنن", 12),
        seg(12, "هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع", 19),
        seg(19, "ومضمون بدون أعراض جانبية", 24),
        seg(24, "استخدموا كود SALEEM20 والرابط في البايو", 33),
      ],
    );
    expect(new Set(codes(r.findings))).toEqual(new Set(["MAW-01", "COM-01", "MAW-03", "MAW-04", "AI-01"]));
  });

  it("produces nothing on the fixed 'herbal tea' version", () => {
    const r = runDeterministicChecks(
      sub({ is_paid_ad: true, ai_used: true, has_written_contract: true, mawthooq_license_no: "MW-2026-48213", caption: "إعلان مدفوع | شاي الأعشاب كود SALEEM20 · المحتوى معدّل بالذكاء الاصطناعي" }),
      [seg(0, "إعلان مدفوع بالتعاون مع متجر نخلة"), seg(4, "هذا شاي أعشاب أشربه بعد العشاء", 14), seg(14, "وأحس فيه بالراحة، وهذي تجربتي الشخصية", 24)],
    );
    expect(r.findings).toEqual([]);
  });
});

describe("schema validation", () => {
  const good = {
    on_screen_text: [{ t: 3, text: " خصم 50٪ " }],
    findings: [
      { rule_code: "com-01", severity: "violation", t_start: 20, t_end: 12, evidence_type: "transcript", evidence_text: "ينحف", explanation_ar: "ا", explanation_en: "e", fix_ar: "ف", fix_en: "f", confidence: 1.4 },
    ],
  };
  it("normalizes codes, clamps confidence/time and swaps reversed ranges", () => {
    const out = validateAnalysis(good, 15);
    expect(out.findings[0]).toMatchObject({ rule_code: "COM-01", t_start: 12, t_end: 15, confidence: 1, source: "llm" });
    expect(out.on_screen_text).toEqual([{ t: 3, text: "خصم 50٪" }]);
  });
  it("rejects bad severities and missing arrays", () => {
    expect(() => validateAnalysis({ on_screen_text: [], findings: [{ ...good.findings[0], severity: "critical" }] }, null)).toThrow(SchemaError);
    expect(() => validateAnalysis({ findings: [] }, null)).toThrow(SchemaError);
  });
  it("parses fenced JSON and rejects prose", () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseModelJson("Sure! here you go")).toThrow(SchemaError);
  });
});

describe("merge", () => {
  const f = (over: Partial<Finding>): Finding => ({
    rule_code: "COM-01", severity: "violation", t_start: 12, t_end: 19, evidence_type: "transcript", evidence_text: "x",
    explanation_ar: "", explanation_en: "", fix_ar: "", fix_en: "", confidence: 0.9, source: "llm", ...over,
  });
  it("drops unknown rule codes", () => {
    const r = mergeAndFilterFindings([f({ rule_code: "XYZ-99" })], new Set(["COM-01"]));
    expect(r.mergedFindings).toEqual([]);
    expect(r.dropped.unknownRule).toEqual(["XYZ-99"]);
    expect(r.overallStatus).toBe("ready");
  });
  it("downgrades weak evidence to a warning", () => {
    const r = mergeAndFilterFindings([f({ confidence: 0.5 })], new Set(["COM-01"]));
    expect(r.mergedFindings[0]?.severity).toBe("warning");
    expect(r.overallStatus).toBe("review");
  });
  it("dedupes the same rule within 3 s, keeping the stronger finding", () => {
    const r = mergeAndFilterFindings(
      [f({ t_start: 12, confidence: 0.75, source: "llm" }), f({ t_start: 14, confidence: 0.9, source: "deterministic" }), f({ t_start: 20 })],
      new Set(["COM-01"]),
    );
    expect(r.mergedFindings.map((x) => [x.t_start, x.source])).toEqual([[14, "deterministic"], [20, "llm"]]);
    expect(r.dropped.duplicates).toBe(1);
  });
  it("keeps one finding for whole-post rules regardless of timestamps", () => {
    const r = mergeAndFilterFindings(
      [f({ rule_code: "MAW-01", t_start: 24, confidence: 0.99 }), f({ rule_code: "MAW-01", t_start: 0, source: "deterministic", confidence: 0.95 })],
      new Set(["MAW-01"]),
    );
    expect(r.mergedFindings).toHaveLength(1);
    expect(r.mergedFindings[0]?.source).toBe("deterministic");
  });
  it("computes READY / REVIEW / NEEDS_FIXES", () => {
    expect(overallStatusOf([])).toBe("ready");
    expect(overallStatusOf([{ severity: "warning" }])).toBe("review");
    expect(overallStatusOf([{ severity: "warning" }, { severity: "violation" }])).toBe("needs_fixes");
  });
});

describe("cost and transcription helpers", () => {
  it("prices tokens and audio", () => {
    expect(textCost("gpt-6.1-sol", { input_tokens: 20_000, output_tokens: 2_000 })).toBeCloseTo(0.06, 5);
    expect(textCost("gpt-6.1-sol", { input_tokens: 20_000, output_tokens: 0, cached_input_tokens: 10_000 })).toBeCloseTo(0.021, 5);
    expect(textCost("unknown", { input_tokens: 1, output_tokens: 1 })).toBe(0);
    expect(audioCost("whisper-1", 90)).toBeCloseTo(0.009, 5);
  });
  it("normalizes provider segments", () => {
    expect(normalizeSegments([{ start: 4, end: 6, text: " ب " }, { start: 0, text: "أ" }, { start: 2, end: 3, text: "" }])).toEqual([
      { start: 0, end: 0, text: "أ" },
      { start: 4, end: 6, text: "ب" },
    ]);
  });
});

describe("pattern hygiene", () => {
  it("all deterministic patterns are written in normalized form", async () => {
    const mod = await import("../supabase/functions/_shared/rules/deterministic.ts");
    const sources = [...mod.DISCLOSURE_PATTERNS, ...mod.AI_DISCLOSURE_PATTERNS, ...mod.PROMO_PATTERNS, ...mod.CLAIM_PATTERNS.map((c) => c.re)].map((r) => r.source);
    expect(sources.filter((s) => /[أإآٱئؤى]/.test(s))).toEqual([]);
  });
});
