// Phase 6.7 — internal-policy rules (case 9): an approved brand rule runs as INT-*, is labelled internal policy,
// never cites regulation, and is never persisted as a rulebook rule id. Model output is mocked.
import { describe, expect, it } from "vitest";
import { evaluate } from "../supabase/functions/_shared/pipeline/evaluate.ts";
import { extractTexts } from "../supabase/functions/_shared/pipeline/context.ts";
import { cleanDrafts, heuristicDrafts, internalRuleRows, rulebookId } from "../supabase/functions/_shared/rules/internal.ts";
import type { ModelOutputV2 } from "../supabase/functions/_shared/pipeline/schema-v2.ts";
import type { AnalysisContext, SubmissionData } from "../supabase/functions/_shared/types.ts";

const ctx = {
  submissionId: "s", promotionId: "p", versionNo: 1, orgId: "o", sector: "banking", communicationType: "financial_promotion",
  channels: ["instagram"], distribution: "owned", creatorLicenseNo: null, audience: ["general"], market: "SA", isPaid: true, caption: null,
  product: null, brandAliases: [], enabledPacks: [], kind: "image",
} as unknown as AnalysisContext;
const sub = { id: "s", is_demo: false, kind: "image", caption: "", text_content: "", platform: "instagram", product_category: "finance",
  is_paid_ad: true, has_written_contract: true, ai_used: false, status: "analyzing", progress: 0, current_step: "llm" } as SubmissionData;

const rows = internalRuleRows([
  { id: "11111111-1111-1111-1111-111111111111", code: "INT-LOGO", title_ar: "سلامة الشعار", instruction_ar: "لا يظهر الشعار ممدوداً أو بألوان خارج الهوية", severity: "warning", status: "active" },
  { id: "22222222-2222-2222-2222-222222222222", code: "INT-FONT", title_ar: "الخط", instruction_ar: "استخدم خط الهوية", severity: "warning", status: "draft" },
]);

const model = (findings: ModelOutputV2["findings"]): ModelOutputV2 => ({
  schema_version: 2,
  classification: { is_advertisement: "yes", language: "ar", detected_product_type: null },
  signals: [],
  ocr: [],
  rule_results: [{ rule_code: "INT-LOGO", outcome: findings.length ? "failed" : "passed", reason: "" }],
  findings,
});

describe("internal rules (case 9)", () => {
  it("only active rules run; ids never look like rulebook ids", () => {
    expect(rows.map((r) => r.code)).toEqual(["INT-LOGO"]);
    expect(rulebookId(rows[0]!.id)).toBeNull();
    expect(rulebookId("11111111-1111-1111-1111-111111111111")).not.toBeNull();
    expect(rows[0]!.llm_instructions).toContain("سياسة داخلية");
    expect(rows[0]!.regulatory_source_id).toBeNull();
  });

  it("a distorted logo raises an internal-policy finding, not a regulatory one", () => {
    const out = evaluate({
      ctx, rules: rows, texts: extractTexts(sub, [], []), legacy: { submission: sub, segments: [], onScreen: [], audioMode: null },
      model: model([{
        rule_code: "INT-LOGO", finding_type: "potential_risk", severity: "warning", confidence: 0.8, source: "llm",
        evidence: { modality: "visual", quote: "", t_start: null, t_end: null, frame_ref: 0 } as never,
        explanation_ar: "الشعار ممدود أفقياً", explanation_en: "The logo is stretched", suggested_fix_ar: "استخدم الشعار الأصلي",
      }]),
      modelStatus: "ok",
      media: { transcriptionFailed: false, framesTotal: 1, framesAnalyzed: 1, batchesFailed: 0 },
    });
    const f = out.findings.find((x) => x.rule_code === "INT-LOGO");
    expect(f).toBeDefined();
    expect(f!.citation["internal_policy"]).toBe(true);
    expect(f!.citation["source_id"]).toBeNull();
    expect(f!.citation["article_ref"]).toBeNull();
  });
});

describe("drafting", () => {
  it("heuristic drafts come from directive sentences only", () => {
    const d = heuristicDrafts("نبذة عن الشركة.\nيجب أن يظهر الشعار بألوانه الأصلية دائماً.\nلا يجوز تمديد الشعار أو تدويره.\nشكراً");
    expect(d.map((x) => x.code)).toEqual(["INT-G01", "INT-G02"]);
    expect(d[1]!.instruction_ar).toContain("لا يجوز");
  });
  it("model drafts are cleaned (codes, duplicates)", () => {
    const d = cleanDrafts({ rules: [
      { code: "int-logo", title_ar: "الشعار", instruction_ar: "x" },
      { code: "INT-LOGO", title_ar: "dup", instruction_ar: "y" },
      { code: "SAMA-1", title_ar: "bad", instruction_ar: "z" },
    ] });
    expect(d.map((x) => x.code)).toEqual(["INT-LOGO"]);
  });
});
