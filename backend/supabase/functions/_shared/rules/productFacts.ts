// Product facts (04_AI_PIPELINE §6.2): figures in the ad vs the approved product's key facts.
// Only approved products are used; a draft product makes these checks unable_to_verify.
import type { AnalysisContext, DraftFinding, ExtractedText } from "../types.ts";
import { extractNumbers, normalizeDigits, sameRate, toMonths } from "./numbers.ts";
import { aprMentions } from "./checks/index.ts";
import * as L from "./lexicon/sa_finance.ts";

export type FactsStatus = "approved" | "draft_product" | "no_product";

export interface FactsResult {
  status: FactsStatus;
  /** Findings keyed by the rule they belong to. */
  findings: DraftFinding[];
}

export const APR_RULE = "SAMA-ADV-03-8";
export const FEES_RULE = "SAMA-ADV-03-5";

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function mismatch(rule_code: string, at: ExtractedText, ar: string, en: string, fixAr: string, fixEn: string, values: Record<string, unknown>): DraftFinding {
  return {
    rule_code,
    finding_type: "confirmed_mismatch",
    severity: "violation",
    confidence: 0.95,
    source: "facts",
    evidence: { modality: at.modality, quote: at.text.slice(0, 240), t_start: at.t_start, t_end: at.t_end, frame_ref: at.frame_ref ?? null, page: at.page ?? null },
    explanation_ar: ar,
    explanation_en: en,
    suggested_fix_ar: fixAr,
    suggested_fix_en: fixEn,
    values,
  };
}

/** A number with this unit within 40 characters after a fee term. */
function feeAmounts(t: ExtractedText): { value: number; unit: "percent" | "SAR" }[] {
  const s = normalizeDigits(t.norm);
  const nums = extractNumbers(s);
  const out: { value: number; unit: "percent" | "SAR" }[] = [];
  const re = new RegExp(L.FEE_TERM.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const end = m.index + m[0].length + 40;
    const n = nums.find((x) => x.index >= m!.index && x.index <= end && (x.unit === "percent" || x.unit === "SAR"));
    if (n) out.push({ value: n.value, unit: n.unit as "percent" | "SAR" });
  }
  return out;
}

export function checkProductFacts(ctx: AnalysisContext, texts: ExtractedText[], tolerance = 0): FactsResult {
  if (!ctx.product) return { status: "no_product", findings: [] };
  if (ctx.product.status !== "approved") return { status: "draft_product", findings: [] };
  const k = ctx.product.keyFacts;
  const findings: DraftFinding[] = [];

  // APR
  if (k.apr && Number.isFinite(k.apr.value)) {
    for (const m of aprMentions(texts)) {
      if (!sameRate(m.value, k.apr.value, tolerance))
        findings.push(mismatch(APR_RULE, m.text,
          `ذكر الإعلان نسبة ${fmt(m.value)}% بينما النسبة المعتمدة للمنتج ${fmt(k.apr.value)}%.`,
          `The ad states ${fmt(m.value)}% while the product's approved APR is ${fmt(k.apr.value)}%.`,
          `صحّح معدل النسبة السنوي إلى ${fmt(k.apr.value)}%.`, `Correct the APR to ${fmt(k.apr.value)}%.`,
          { stated: m.value, approved: k.apr.value, field: "apr" }));
    }
  }

  // Term
  if (k.term_months) {
    for (const t of texts) {
      for (const n of extractNumbers(t.norm)) {
        const months = toMonths(n);
        if (months === null) continue;
        if (months < k.term_months.min || months > k.term_months.max)
          findings.push(mismatch(APR_RULE, t,
            `ذكر الإعلان مدة ${fmt(months)} شهراً خارج المدة المعتمدة (${k.term_months.min}–${k.term_months.max} شهراً).`,
            `The ad states a ${fmt(months)}-month term outside the approved ${k.term_months.min}–${k.term_months.max} months.`,
            `استخدم مدة ضمن ${k.term_months.min}–${k.term_months.max} شهراً.`, `Use a term within ${k.term_months.min}–${k.term_months.max} months.`,
            { stated: months, approved: k.term_months, field: "term_months" }));
      }
    }
  }

  // Fees
  const approvedFees = (k.fees ?? []).filter((f) => Number.isFinite(f.amount));
  const charged = approvedFees.filter((f) => f.amount > 0);
  if (charged.length) {
    const free = texts.find((t) => L.hit(L.FREE, t.norm) && !L.hit(L.TARGET_GROUP, t.norm) || /(بدون (اي )?رسوم|بلا رسوم|صفر رسوم)/.test(t.norm));
    if (free)
      findings.push(mismatch(FEES_RULE, free,
        "يذكر الإعلان «بدون رسوم» بينما للمنتج رسوم معتمدة.",
        "The ad says “no fees” while the product has approved fees.",
        `اذكر الرسوم المعتمدة: ${charged.map((f) => `${f.name_ar} ${fmt(f.amount)}${f.unit === "percent" ? "%" : " ريال"}`).join("، ")}.`,
        "State the approved fees.",
        { stated: 0, approved: charged.map((f) => ({ name_ar: f.name_ar, amount: f.amount, unit: f.unit })), field: "fees" }));
    for (const t of texts) {
      for (const a of feeAmounts(t)) {
        const ok = approvedFees.some((f) => f.unit === a.unit && sameRate(f.amount, a.value) || (f.cap_sar != null && a.unit === "SAR" && sameRate(f.cap_sar, a.value)));
        if (!ok)
          findings.push(mismatch(FEES_RULE, t,
            `ذكر الإعلان رسوماً بقيمة ${fmt(a.value)}${a.unit === "percent" ? "%" : " ريال"} لا تطابق الرسوم المعتمدة للمنتج.`,
            `The ad states a fee of ${fmt(a.value)}${a.unit === "percent" ? "%" : " SAR"} that does not match the approved fees.`,
            "صحّح قيمة الرسوم وفق بيانات المنتج المعتمدة.", "Correct the fee to the approved value.",
            { stated: a, approved: approvedFees.map((f) => ({ name_ar: f.name_ar, amount: f.amount, unit: f.unit, cap_sar: f.cap_sar ?? null })), field: "fees" }));
      }
    }
  }
  return { status: "approved", findings };
}
