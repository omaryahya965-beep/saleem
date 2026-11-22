// Phase 8 step 4: check_mode semantics, duplicate drafts, pack reasons, triggers, citations (pure engine, no model).
import { describe, expect, it } from "vitest";
import { evaluate } from "../supabase/functions/_shared/pipeline/evaluate.ts";
import { buildContext, extractTexts } from "../supabase/functions/_shared/pipeline/context.ts";
import { enabledPacksFor } from "../supabase/functions/_shared/rules/applicability.ts";
import { computeSignals } from "../supabase/functions/_shared/rules/signals.ts";
import type { ModelOutputV2 } from "../supabase/functions/_shared/pipeline/schema-v2.ts";
import type { RuleRow, SubmissionData } from "../supabase/functions/_shared/types.ts";

const REL = "22222222-2222-2222-2222-222222222222";
const mk = (code: string, mode: RuleRow["check_mode"], extra: Partial<RuleRow> = {}): RuleRow => ({
  id: `id-${code}`, code, category: "commerce", pack: "sa-x", regulatory_source_id: "sa:X", source_status: "unknown", article_ref: "م1",
  title_ar: code, title_en: code, summary_ar: `فحص ${code}`, summary_en: null,
  check_kind: mode === "document" || mode === "workflow" ? "workflow" : mode === "hybrid" ? "hybrid" : "llm",
  deterministic_check: null, finding_type_on_fail: "potential_risk", default_severity: "violation", applicability: {}, content_triggers: [],
  llm_instructions: "", review_state: "active", check_mode: mode, evidence_policy_ar: `سياسة ${code}`, applicability_ar: "عام", rule_version: REL,
  ...extra,
});
const RULES = [
  mk("C1", "content"),
  mk("D1", "document"),
  mk("W1", "workflow"),
  mk("H1", "hybrid"),
  mk("DUP", "content", { possible_duplicate_of: "SAMA-ADV-01", review_state: "draft" }),
  mk("OUT", "content", { applicability: { sectors: ["insurance"] } }),
];
const sub = (text: string, kind: SubmissionData["kind"] = "text"): SubmissionData => ({
  id: "s1", is_demo: false, kind, caption: "", text_content: text, platform: "x", product_category: "finance",
  is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: null, status: "analyzing", progress: 0, current_step: "llm",
});
const ctx = (text: string, kind: SubmissionData["kind"] = "text") =>
  buildContext({
    submission: sub(text, kind),
    promotion: { id: "pr1", org_id: "org", communication_type: "financial_promotion", channels: ["instagram"], distribution: "owned",
      creator_license_no: null, audience: ["general"], market: "SA", is_paid: true, caption: null },
    product: null,
    orgSettings: { sector: "banking", brand_aliases: [] },
    packs: [
      { code: "sa-x", default_sectors: [], enabled_by_default: false, always_enabled: false },
      { code: "sa-system", default_sectors: [], enabled_by_default: true, always_enabled: true },
      { code: "sa-sama-advertising", default_sectors: ["banking"], enabled_by_default: true, always_enabled: false },
    ],
    orgPacks: [{ pack_code: "sa-x", enabled: true, include_draft_rules: true }],
  });
const model = (findings: ModelOutputV2["findings"] = []): ModelOutputV2 => ({
  schema_version: 2, classification: { is_advertisement: "yes", language: "ar", detected_product_type: null }, signals: [], ocr: [],
  rule_results: RULES.map((r) => ({ rule_code: r.code, outcome: "passed", reason: "" })), findings,
});
const finding = (code: string, type: ModelOutputV2["findings"][number]["finding_type"] = "missing_required") => ({
  rule_code: code, finding_type: type, severity: "violation" as const, confidence: 0.95, source: "llm" as const,
  evidence: { modality: "caption" as const, quote: "نص", t_start: 3, t_end: 4 }, explanation_ar: "x", explanation_en: "x",
  missing_information_ar: null, suggested_fix_ar: "y", suggested_fix_en: "y",
});
function run(opts: { findings?: ModelOutputV2["findings"]; modelOk?: boolean; partial?: boolean } = {}) {
  const s = sub("إعلان");
  return evaluate({
    ctx: ctx("إعلان", opts.partial ? "video" : "text"), rules: RULES, texts: extractTexts(s, [], []),
    legacy: { submission: s, segments: [], onScreen: [], audioMode: null },
    model: opts.modelOk === false ? null : model(opts.findings), modelStatus: opts.modelOk === false ? "failed" : "ok",
    media: { transcriptionFailed: Boolean(opts.partial), framesTotal: 0, framesAnalyzed: 0, batchesFailed: 0 },
  });
}
const rc = (r: ReturnType<typeof run>, code: string) => r.ruleChecks.find((c) => c.rule_code === code)!;

describe("check_mode", () => {
  it("document: a «يحتاج مستنداً» request, never a violation, and never sent to the model", () => {
    const r = run({ findings: [finding("D1")] }); // a model finding for D1 must be ignored
    const d = r.findings.filter((f) => f.rule_code === "D1");
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ finding_type: "needs_evidence", severity: "warning", source: "deterministic" });
    expect(d[0]!.explanation_ar).toContain("يحتاج مستنداً");
    expect(d[0]!.citation).toMatchObject({ evidence_policy_ar: "سياسة D1", check_mode: "document" });
    expect(rc(r, "D1")).toMatchObject({ outcome: "unable_to_verify", reason: "document_required" });
  });
  it("workflow: a reviewer checklist item, never a finding or a model guess", () => {
    const r = run({ findings: [finding("W1")] });
    expect(r.findings.some((f) => f.rule_code === "W1")).toBe(false);
    expect(rc(r, "W1")).toMatchObject({ outcome: "unable_to_verify", reason: "reviewer_checklist" });
  });
  it("hybrid: capped at a potential risk (warning) with the evidence request", () => {
    const f = run({ findings: [finding("H1", "missing_required")] }).findings.find((x) => x.rule_code === "H1")!;
    expect(f).toMatchObject({ finding_type: "potential_risk", severity: "warning" });
    expect(f.citation).toMatchObject({ evidence_request_ar: "سياسة H1" });
  });
  it("content: incomplete analysis is «تعذّر التحقق», not «سليم»", () => {
    expect(rc(run({ partial: true }), "C1")).toMatchObject({ outcome: "unable_to_verify", reason: "coverage:partial" });
    expect(rc(run(), "C1").outcome).toBe("passed");
  });
  it("no model: no fabricated findings, content rules unable to verify", () => {
    const r = run({ modelOk: false });
    expect(r.findings.filter((f) => f.source === "llm")).toHaveLength(0);
    expect(rc(r, "C1")).toMatchObject({ outcome: "unable_to_verify", reason: "coverage:model" });
  });
  it("findings carry evidence_policy_ar and the rule version", () => {
    const f = run({ findings: [finding("C1", "potential_risk")] }).findings.find((x) => x.rule_code === "C1")!;
    expect(f.citation).toMatchObject({ evidence_policy_ar: "سياسة C1", rule_version: REL, check_mode: "content" });
  });
});

describe("scope", () => {
  it("a draft (here a possible duplicate) is never applied, with the reason (D217: drafts never produce findings)", () => {
    const r = run({ findings: [finding("DUP")] });
    expect(r.findings.some((f) => f.rule_code === "DUP")).toBe(false);
    expect(rc(r, "DUP")).toMatchObject({ outcome: "not_applicable", reason: "draft_excluded" });
  });
  it("out-of-scope rules say why", () => {
    expect(rc(run(), "OUT")).toMatchObject({ outcome: "not_applicable", reason: "context:sector" });
  });
  it("reports the packs applied and why", () => {
    const packs = run().coverage.packs!;
    // D217: every pack is considered for an organisation too, never with drafts; org_rule_packs no longer narrows it.
    expect(packs.find((p) => p.code === "sa-x")).toMatchObject({ reason: "all_authorities", include_drafts: false });
    expect(packs.find((p) => p.code === "sa-system")?.reason).toBe("always_enabled");
    expect(packs.find((p) => p.code === "sa-sama-advertising")?.reason).toBe("all_authorities");
    expect(enabledPacksFor(null, null, [{ code: "sa-x", default_sectors: [], enabled_by_default: false, always_enabled: false }], [])[0]?.reason).toBe("personal_all"); // D213
  });
  it("cross-sector triggers are specific", () => {
    const sig = (t: string) => computeSignals(extractTexts(sub(t), [], []), { product: null });
    expect(sig("شارك في المسابقة واربح جائزة").has("contest_or_prize")).toBe(true);
    expect(sig("تخفيضات حتى 50% على كل المنتجات").has("discount_sale")).toBe(true);
    expect(sig("هدية مع كل طلب").has("discount_sale")).toBe(false);
    expect(sig("للاشتراك ارسل رسالة نصية، ولإلغاء الاشتراك أرسل 1").has("direct_marketing")).toBe(true);
    expect(sig("تمويل شخصي بمعدل 4%").has("contest_or_prize")).toBe(false);
  });
});
