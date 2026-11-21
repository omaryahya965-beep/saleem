// SALEEM V2 upgrade (D170, D171): the advertisement's own sector decides which sector packs apply, and
// MAW-03/04 no longer fire for an organisation publishing a general commercial ad on its own channels.
// Uses the Nada Cream V1 texts from the manual test (fictional product). No model call.
import { describe, expect, it } from "vitest";
import { applicabilityMismatch, selectRules } from "../supabase/functions/_shared/rules/applicability.ts";
import { buildContext, extractTexts } from "../supabase/functions/_shared/pipeline/context.ts";
import { evaluate } from "../supabase/functions/_shared/pipeline/evaluate.ts";
import type { SubmissionData, TranscriptSegment } from "../supabase/functions/_shared/types.ts";
import { releaseRules } from "../eval/rules-v2.ts";
import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";

const RULES = releaseRules();
const PACKS = [
  { code: "sa-gmedia-creators", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-sdaia-ai", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-mc-ecommerce", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-sama-advertising", default_sectors: ["banking", "finance_company", "payments"], enabled_by_default: true, always_enabled: false },
  { code: "sa-system", default_sectors: [], enabled_by_default: true, always_enabled: true },
];
const NADA = {
  id: "nada", name_ar: "كريم ندى", name_en: "Nada Cream", aliases: [], sector: "cosmetics", product_type: "skincare",
  regulator: "SFDA", currency: "SAR", status: "approved" as const, key_facts: {},
};

function sub(): SubmissionData {
  return {
    id: "s1", is_demo: false, kind: "video", caption: "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنواع البشرة.",
    text_content: null, platform: "snapchat", product_category: "beauty", is_paid_ad: true, has_written_contract: false, ai_used: false,
    mawthooq_license_no: null, status: "analyzing", progress: 0, current_step: "llm",
  };
}
const SEGMENTS: TranscriptSegment[] = [
  { start: 0, end: 5, text: "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أنواع البشرة" },
  { start: 5.461, end: 9, text: "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية" },
];

function ctx(opts: { communication: "general_commercial" | "creator_sponsored"; distribution: "owned" | "influencer"; adSector?: string | null; product?: typeof NADA | null }) {
  return buildContext({
    submission: sub(),
    promotion: { id: "p1", org_id: "org", communication_type: opts.communication, sector: opts.adSector ?? null, channels: ["snapchat"],
      distribution: opts.distribution, creator_license_no: null, audience: ["general"], market: "SA", is_paid: true, caption: null },
    product: opts.product === undefined ? NADA : opts.product,
    orgSettings: { sector: "banking", brand_aliases: [] },
    packs: PACKS,
    orgPacks: [{ pack_code: "sa-sama-advertising", enabled: true, include_draft_rules: true }],
  });
}

describe("advertisement sector (D170)", () => {
  it("a bank's cosmetic ad without a product uses the ad's own sector, not the organisation's", () => {
    const c = ctx({ communication: "general_commercial", distribution: "owned", adSector: "cosmetics", product: null });
    expect(c.sector).toBe("cosmetics");
    const sel = selectRules(c, RULES);
    const sama = sel.applicable.filter((r) => r.pack === "sa-sama-advertising");
    expect(sama).toHaveLength(0);
  });
  it("falls back to the organisation sector when the ad has none (unchanged behaviour)", () => {
    expect(ctx({ communication: "general_commercial", distribution: "owned", adSector: null, product: null }).sector).toBe("banking");
  });
});

describe("MAW-03/04 scope (D171)", () => {
  it("own-channel general commercial ad: MAW-03/04 not applicable, MAW-01 still applies", () => {
    const c = ctx({ communication: "general_commercial", distribution: "owned" });
    const sel = selectRules(c, RULES);
    const applicable = sel.applicable.map((r) => r.code);
    expect(applicable).toContain("MAW-01");
    expect(applicable).not.toContain("MAW-03");
    expect(applicable).not.toContain("MAW-04");
    expect(sel.notApplicable.find((n) => n.rule.code === "MAW-03")?.reason).toBe("context:communication_type");
  });
  it("creator-sponsored or influencer distribution: MAW-03/04 apply", () => {
    for (const o of [{ communication: "creator_sponsored", distribution: "owned" }, { communication: "general_commercial", distribution: "influencer" }] as const) {
      const codes = selectRules(ctx(o), RULES).applicable.map((r) => r.code);
      expect(codes).toEqual(expect.arrayContaining(["MAW-03", "MAW-04"]));
    }
  });
  it("Nada Cream V1 on own channels: COM-01 and MAW-01 are found, MAW-03/04 are not", () => {
    const c = ctx({ communication: "general_commercial", distribution: "owned" });
    const s = sub();
    const r = evaluate({
      ctx: c, rules: RULES, texts: extractTexts(s, SEGMENTS, [{ t: 11, text: "النتيجة مضمونة خلال ٣ أيام" }]),
      legacy: { submission: s, segments: SEGMENTS, onScreen: [{ t: 11, text: "النتيجة مضمونة خلال ٣ أيام" }], audioMode: "speech" },
      model: null, modelStatus: "failed",
      media: { transcriptionFailed: false, framesTotal: 1, framesAnalyzed: 1, batchesFailed: 0 },
    });
    const codes = new Set(r.findings.map((f) => f.rule_code));
    expect(codes.has("COM-01")).toBe(true);
    expect(codes.has("MAW-01")).toBe(true);
    expect(codes.has("MAW-03")).toBe(false);
    expect(codes.has("MAW-04")).toBe(false);
  });
  it("the applicability grammar itself", () => {
    const a = { any_of: [{ communication_types: ["creator_sponsored"] }, { distribution: ["influencer"] }] };
    expect(applicabilityMismatch(a, ctx({ communication: "general_commercial", distribution: "owned" }))).not.toBeNull();
    expect(applicabilityMismatch(a, ctx({ communication: "general_commercial", distribution: "influencer" }))).toBeNull();
  });
});

describe("COM-01 claim patterns (D188, eval false negatives)", () => {
  const promo = (text: string) => {
    const s = { ...sub(), caption: "", is_paid_ad: true };
    return runDeterministicChecks(s, [{ start: 0, end: 5, text }], []).findings.map((f) => f.rule_code);
  };
  it("absolute removal without «مضمون»", () => expect(promo("يقضي على حب الشباب نهائياً خلال أسبوع")).toContain("COM-01"));
  it("«من غير أي آثار جانبية»", () => expect(promo("آمن ومن غير أي آثار جانبية")).toContain("COM-01"));
  it("English absolute claims", () => expect(promo("Guaranteed results with no side effects")).toContain("COM-01"));
  it("no false alarm on a plain care claim or a makeup remover", () => {
    expect(promo("كريم مرطب للاستخدام اليومي")).not.toContain("COM-01");
    expect(promo("مزيل المكياج يزيل المكياج تماماً")).not.toContain("COM-01");
  });
});
