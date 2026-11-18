// Phase 5: claims matching (six classes, Arabic variants, numbers), disclaimers, org overrides; case 4 via the library.
import { describe, expect, it } from "vitest";
import { classifyClaim, checkDisclaimers, disclaimerOverlap, matchClaims, similarity, type LibClaim, type LibDisclaimer } from "../supabase/functions/_shared/claims/match.ts";
import { applyOverrides, selectRules } from "../supabase/functions/_shared/rules/applicability.ts";
import { evaluate } from "../supabase/functions/_shared/pipeline/evaluate.ts";
import { extractTexts } from "../supabase/functions/_shared/pipeline/context.ts";
import type { AnalysisContext, RuleRow, SubmissionData } from "../supabase/functions/_shared/types.ts";
import { releaseRules } from "../eval/rules-v2.ts";

const ctx = {
  submissionId: "s", promotionId: "p", versionNo: 1, orgId: "o", sector: "banking", communicationType: "financial_promotion",
  channels: ["instagram"], distribution: "owned", creatorLicenseNo: null, audience: ["general"], market: "SA", isPaid: true, caption: null,
  product: { id: "prod1", nameAr: "تمويل شخصي المثال", nameEn: null, aliases: [], sector: "banking", productType: "personal_finance", regulator: "SAMA", currency: "SAR", status: "approved", keyFacts: {} },
  brandAliases: ["بنك المثال"], enabledPacks: [{ code: "sa-system", includeDrafts: false }], kind: "text",
} as AnalysisContext;

const claim = (over: Partial<LibClaim>): LibClaim => ({
  id: "c1", claim_key: "k1", version: 1, name: "n", text_ar: "أكثر من 45,000 عميل", status: "approved", product_ids: [], channels: [], communication_types: [], ...over,
});

describe("claim matching", () => {
  it("exact and Arabic variants (hamza, taa marbuta, Arabic-Indic digits) match an approved claim", () => {
    expect(similarity("اكثر من ٤٥٬٠٠٠ عميل", "أكثر من 45,000 عميل")).toBeGreaterThan(0.9);
    expect(classifyClaim("أكثر من 45,000 عميل", [claim({})], ctx)).toBeNull();
    expect(classifyClaim("اكثر من ٤٥٬٠٠٠ عميل", [claim({})], ctx)).toBeNull();
  });
  it("number mismatch → confirmed mismatch class", () => {
    expect(classifyClaim("أكثر من 50,000 عميل", [claim({})], ctx)?.cls).toBe("number_mismatch");
  });
  it("not in library, pending, similar wording, out of scope, expired", () => {
    expect(classifyClaim("الأقل تكلفة في المملكة", [claim({})], ctx)?.cls).toBe("not_in_library");
    expect(classifyClaim("أكثر من 45,000 عميل", [claim({ status: "pending_review" })], ctx)?.cls).toBe("matching_not_approved");
    expect(classifyClaim("لدينا أكثر من 45,000 عميل سعيد معنا", [claim({ status: "pending_review" })], ctx)?.cls).toBe("similar_wording_not_approved");
    expect(classifyClaim("أكثر من 45,000 عميل", [claim({ product_ids: ["other"] })], ctx)?.cls).toBe("out_of_scope");
    expect(classifyClaim("أكثر من 45,000 عميل", [claim({ product_ids: ["other"] })], ctx, new Set(["c1"]))).toBeNull(); // linked claims are always in scope
    expect(classifyClaim("أكثر من 45,000 عميل", [claim({ status: "expired" })], ctx)?.cls).toBe("expired");
  });
  it("candidates come from sentences with numbers or superlatives and from the model", () => {
    const texts = extractTexts({ caption: "تمويل سريع. الأقل تكلفة في المملكة. زورونا.", kind: "text", text_content: "" }, [], []);
    const f = matchClaims({ ctx, texts, claims: [claim({})], modelQuotes: ["الخيار الأول للمواطنين"] });
    expect(f.map((x) => x.evidence.quote)).toEqual(["الأقل تكلفة في المملكة", "الخيار الأول للمواطنين"]);
    expect(f.every((x) => x.rule_code === "SYS-CLAIMS" && x.finding_type === "needs_evidence")).toBe(true);
  });
});

const disc = (over: Partial<LibDisclaimer>): LibDisclaimer => ({
  id: "d1", name: "إشراف", text_ar: "بنك المثال خاضع لإشراف ورقابة البنك المركزي السعودي", product_types: [], channels: [], communication_types: ["financial_promotion"],
  required_by_rule_codes: [], check_prominence: false, ...over,
});

describe("disclaimers", () => {
  it("presence tolerates minor variations; missing → missing_required", () => {
    expect(disclaimerOverlap(disc({}).text_ar, "بنك المثال خاضع لاشراف ورقابه البنك المركزي السعودي.")).toBe(1);
    const t = (s: string) => extractTexts({ caption: s, kind: "text", text_content: "" }, [], []);
    expect(checkDisclaimers([disc({})], ctx, t("بنك المثال خاضع لإشراف ورقابة البنك المركزي السعودي"), new Set())).toEqual([]);
    const miss = checkDisclaimers([disc({})], ctx, t("تمويل شخصي"), new Set());
    expect(miss).toHaveLength(1);
    expect(miss[0]).toMatchObject({ rule_code: "SYS-DISCLAIMERS", finding_type: "missing_required" });
    expect(checkDisclaimers([disc({ communication_types: ["internal"] })], ctx, t("x"), new Set())).toEqual([]);
    expect(checkDisclaimers([disc({ communication_types: ["internal"], required_by_rule_codes: ["SAMA-ADV-03-9"] })], ctx, t("x"), new Set(["SAMA-ADV-03-9"]))).toHaveLength(1);
  });
});

describe("org overrides", () => {
  const rules = releaseRules();
  const c = { ...ctx, channels: ["branch"], enabledPacks: [{ code: "sa-sama-advertising", includeDrafts: true }] };
  it("narrow a rule out of scope (never into scope) and leave system rules alone", () => {
    const sel = applyOverrides(selectRules(c, rules), c, [
      { rule_code: "SAMA-ADV-01", applicability_patch: { exclude_channels: ["branch"] } },
      { rule_code: "SAMA-ADV-02", applicability_patch: { disabled: true } },
    ]);
    expect(sel.notApplicable.find((n) => n.rule.code === "SAMA-ADV-01")?.reason).toBe("org_override");
    expect(sel.notApplicable.find((n) => n.rule.code === "SAMA-ADV-02")?.reason).toBe("org_override");
    expect(sel.applicable.some((r) => r.code === "SAMA-ADV-03-9")).toBe(true);
  });
});

describe("case 4 via the claims library", () => {
  const SYS_CLAIMS: RuleRow = {
    id: "rule:SYS-CLAIMS", code: "SYS-CLAIMS", category: "system", pack: "sa-system", regulatory_source_id: null, source_status: null, article_ref: null,
    title_ar: "ادعاءات", title_en: "Claims", summary_ar: null, summary_en: null, check_kind: "deterministic", deterministic_check: null,
    finding_type_on_fail: "needs_evidence", default_severity: "warning", applicability: {}, content_triggers: [], llm_instructions: "", review_state: "active",
  };
  const sub = { id: "s", is_demo: false, kind: "text", caption: "", text_content: "الأقل تكلفة في المملكة", platform: "x", product_category: "finance",
    is_paid_ad: true, has_written_contract: true, ai_used: false, status: "analyzing", progress: 0, current_step: "llm" } as SubmissionData;
  const run = (claims: LibClaim[]) =>
    evaluate({
      ctx, rules: [SYS_CLAIMS], texts: extractTexts(sub, [], []), legacy: { submission: sub, segments: [], onScreen: [], audioMode: null },
      model: null, modelStatus: "ok", library: { claims, disclaimers: [], linkedClaimIds: [], overrides: [] },
      media: { transcriptionFailed: false, framesTotal: 0, framesAnalyzed: 0, batchesFailed: 0 },
    });
  it("«الأقل تكلفة في المملكة» → SYS-CLAIMS not_in_library; after the claim is approved, it passes", () => {
    const before = run([claim({})]);
    expect(before.findings.map((f) => [f.rule_code, f.finding_type, f.citation["claim_class"]])).toEqual([["SYS-CLAIMS", "needs_evidence", "not_in_library"]]);
    const after = run([claim({}), claim({ id: "c2", claim_key: "k2", text_ar: "الأقل تكلفة في المملكة" })]);
    expect(after.findings).toEqual([]);
    expect(after.ruleChecks.find((r) => r.rule_code === "SYS-CLAIMS")?.outcome).toBe("passed");
  });
  it("no approved claims → the library check is not applicable", () => {
    expect(run([]).ruleChecks.find((r) => r.rule_code === "SYS-CLAIMS")).toMatchObject({ outcome: "not_applicable", reason: "no_claims_library" });
  });
});
