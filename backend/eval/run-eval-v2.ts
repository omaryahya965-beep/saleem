// Rule engine v2 evaluation.  npm run eval:v2 [-- --case=<id>]
// Runs eval/cases-v2.json through the production evaluator (_shared/pipeline/evaluate.ts) offline:
// deterministic checks + product facts + recorded model output (no network, no API key).
// Metrics (06_TEST_PLAN §4): precision, recall, citation accuracy, rule-applicability accuracy,
// unable-to-verify rate. Unit of counting: (case, rule_code, finding_type).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluate } from "../supabase/functions/_shared/pipeline/evaluate.ts";
import { buildContext, extractTexts, type ProductRow } from "../supabase/functions/_shared/pipeline/context.ts";
import type { ModelOutputV2 } from "../supabase/functions/_shared/pipeline/schema-v2.ts";
import type { DraftFinding, SubmissionData } from "../supabase/functions/_shared/types.ts";
import { releaseRules } from "./rules-v2.ts";

interface CaseV2 {
  id: string;
  title: string;
  kind?: "text" | "video";
  caption: string;
  segments?: { start: number; end: number; text: string }[];
  on_screen?: { t: number; text: string }[];
  product?: string | null;
  product_status?: "draft" | "approved";
  drafts?: boolean;
  communication_type?: string;
  distribution?: string;
  audience?: string[];
  model_findings?: { rule_code: string; finding_type: DraftFinding["finding_type"]; severity: "violation" | "warning"; confidence: number; quote: string }[];
  expected: { rule: string; type: string }[];
  not_applicable?: string[];
  unable?: string[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const file = JSON.parse(fs.readFileSync(path.join(here, "cases-v2.json"), "utf8")) as {
  defaults: Record<string, unknown>;
  texts: Record<string, string>;
  cases: CaseV2[];
};
const only = process.argv.find((a) => a.startsWith("--case="))?.slice(7);
const RULES = releaseRules();
const ruleByCode = new Map(RULES.map((r) => [r.code, r]));
const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => file.texts[k] ?? "");

const FACTS: Record<string, unknown> = {
  personal_finance: { apr: { value: 4.5, type: "fixed" }, term_months: { min: 6, max: 60 }, fees: [{ name_ar: "رسوم إدارية", amount: 1, unit: "percent", cap_sar: 5000, vat_included: true }] },
  real_estate_finance: { apr: { value: 5.1, type: "variable" }, term_months: { min: 12, max: 300 }, fees: [{ name_ar: "رسوم إدارية", amount: 1, unit: "percent", cap_sar: 5000, vat_included: true }] },
  current_account: { fees: [] },
  prepaid_card: {},
};
const NAMES: Record<string, string> = {
  personal_finance: "تمويل شخصي المثال", real_estate_finance: "تمويل عقاري المثال", current_account: "حساب جاري المثال", prepaid_card: "بطاقة السفر المثال",
};
const PACKS = [
  { code: "sa-gmedia-creators", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-sdaia-ai", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-mc-ecommerce", default_sectors: [], enabled_by_default: true, always_enabled: false },
  { code: "sa-sama-advertising", default_sectors: ["banking", "finance_company", "payments"], enabled_by_default: true, always_enabled: false },
  { code: "sa-cma-securities", default_sectors: ["capital_market"], enabled_by_default: false, always_enabled: false },
  { code: "sa-system", default_sectors: [], enabled_by_default: true, always_enabled: true },
];

let tp = 0, fp = 0, fn = 0, citeOk = 0, appOk = 0, appTotal = 0, unableCount = 0, applicableCount = 0;
const rows: unknown[] = [];
const t0 = Date.now();
for (const c of file.cases.filter((x) => !only || x.id === only)) {
  const d = { ...file.defaults, ...c } as CaseV2 & typeof file.defaults;
  const productType = c.product === undefined ? (file.defaults.product as string) : c.product;
  const product: ProductRow | null = productType
    ? { id: `p-${productType}`, name_ar: NAMES[productType] ?? productType, name_en: null, aliases: [], sector: "banking", product_type: productType,
        regulator: "SAMA", currency: "SAR", status: c.product_status ?? "approved", key_facts: FACTS[productType] ?? {} }
    : null;
  const kind = c.kind ?? "text";
  const caption = fill(c.caption);
  const sub = { id: c.id, is_demo: false, kind, caption: kind === "text" ? "" : caption, text_content: kind === "text" ? caption : null, platform: "x",
    product_category: "finance", is_paid_ad: true, has_written_contract: true, ai_used: false, mawthooq_license_no: null, status: "analyzing",
    progress: 0, current_step: "llm" } as SubmissionData;
  const ctx = buildContext({
    submission: sub,
    promotion: { id: `pr-${c.id}`, org_id: "org_bank", communication_type: (d.communication_type as never) ?? "financial_promotion",
      channels: ["instagram"], distribution: (d.distribution as string) ?? "owned", creator_license_no: null, audience: (d.audience as string[]) ?? ["general"],
      market: "SA", is_paid: true, caption: null },
    product,
    orgSettings: { sector: "banking", brand_aliases: ["بنك المثال"] },
    packs: PACKS,
    orgPacks: d.drafts === false ? [] : [{ pack_code: "sa-sama-advertising", enabled: true, include_draft_rules: true }],
  });
  const model: ModelOutputV2 = {
    schema_version: 2, classification: { is_advertisement: "yes", language: "ar", detected_product_type: null }, signals: [], ocr: [],
    rule_results: c.id === "fin-17-injection" ? [] : RULES.map((r) => ({ rule_code: r.code, outcome: "passed" as const, reason: "" })),
    findings: (c.model_findings ?? []).map((f) => ({
      rule_code: f.rule_code, finding_type: f.finding_type, severity: f.severity, confidence: f.confidence, source: "llm" as const,
      evidence: { modality: "caption" as const, quote: f.quote, t_start: null, t_end: null }, explanation_ar: "—", explanation_en: "—",
      suggested_fix_ar: "—", suggested_fix_en: "—",
    })),
  };
  const segments = c.segments ?? [];
  const onScreen = c.on_screen ?? [];
  const r = evaluate({
    ctx, rules: RULES, texts: extractTexts(sub, segments, onScreen), legacy: { submission: sub, segments, onScreen, audioMode: kind === "video" ? "speech" : null },
    model, modelStatus: "ok", media: { transcriptionFailed: false, framesTotal: 0, framesAnalyzed: 0, batchesFailed: 0 },
  });
  // Detection metrics over financial/system rules (creator rules are covered by eval/cases.json).
  const produced = new Set(r.findings.filter((f) => !f.rule_code.match(/^(MAW|CNT|AI|COM)-/)).map((f) => `${f.rule_code}|${f.finding_type}`));
  const expected = new Set(c.expected.map((e) => `${e.rule}|${e.type}`));
  const hits = [...produced].filter((x) => expected.has(x));
  tp += hits.length;
  fp += [...produced].filter((x) => !expected.has(x)).length;
  fn += [...expected].filter((x) => !produced.has(x)).length;
  for (const h of hits) {
    const [code] = h.split("|");
    const f = r.findings.find((x) => x.rule_code === code)!;
    if ((f.citation as { article_ref?: string | null }).article_ref === (ruleByCode.get(code!)?.article_ref ?? null)) citeOk++;
  }
  for (const code of c.not_applicable ?? []) {
    appTotal++;
    if (r.ruleChecks.find((x) => x.rule_code === code)?.outcome === "not_applicable") appOk++;
  }
  for (const e of c.expected) {
    appTotal++;
    const outcome = r.ruleChecks.find((x) => x.rule_code === e.rule)?.outcome;
    if (outcome && outcome !== "not_applicable") appOk++;
  }
  const unable = r.ruleChecks.filter((x) => x.outcome === "unable_to_verify");
  unableCount += unable.length;
  applicableCount += r.ruleChecks.filter((x) => x.outcome !== "not_applicable").length;
  const unableOk = (c.unable ?? []).every((code) => unable.some((u) => u.rule_code === code));
  rows.push({
    case: c.id, ok: hits.length === expected.size && produced.size === expected.size && unableOk,
    produced: [...produced], expected: [...expected], unable: unable.map((u) => `${u.rule_code}:${u.reason}`), overall: r.overallStatus, coverage: r.coverage.status,
  });
}

const summary = {
  engine: "v2", mode: "deterministic+product-facts+recorded-model-output", cases: rows.length, date: new Date().toISOString().slice(0, 10),
  precision: tp + fp ? tp / (tp + fp) : 1, recall: tp + fn ? tp / (tp + fn) : 1, citation_accuracy: tp ? citeOk / tp : 1,
  applicability_accuracy: appTotal ? appOk / appTotal : 1, unable_to_verify_rate: applicableCount ? unableCount / applicableCount : 0,
  true_positives: tp, false_positives: fp, false_negatives: fn, ms_total: Date.now() - t0,
};
console.table(rows.map((x) => { const r = x as { case: string; ok: boolean; produced: string[] }; return { case: r.case, ok: r.ok, produced: r.produced.join(" ") }; }));
console.log("Summary:", summary);
fs.mkdirSync(path.join(here, "results"), { recursive: true });
if (!only) fs.writeFileSync(path.join(here, "results", "v2-latest.json"), JSON.stringify({ summary, cases: rows }, null, 2));
process.exitCode = rows.every((x) => (x as { ok: boolean }).ok) ? 0 : 1;
