// Claims and disclaimers libraries (04_AI_PIPELINE §6.4). Pure: runs in Deno and Vitest.
import type { AnalysisContext, DraftFinding, ExtractedText } from "../types.ts";
import { normalizeArabic } from "../rules/arabic.ts";
import { extractNumbers, normalizeDigits } from "../rules/numbers.ts";
import { SUPERLATIVE, hit } from "../rules/lexicon/sa_finance.ts";

export interface LibClaim {
  id: string;
  claim_key: string;
  version: number;
  name: string;
  text_ar: string;
  status: string;
  product_ids: string[];
  channels: string[];
  communication_types: string[];
}

export interface LibDisclaimer {
  id: string;
  name: string;
  text_ar: string;
  product_types: string[];
  channels: string[];
  communication_types: string[];
  required_by_rule_codes: string[];
  check_prominence: boolean;
}

export type ClaimClass =
  | "not_in_library"
  | "matching_not_approved"
  | "similar_wording_not_approved"
  | "out_of_scope"
  | "expired"
  | "number_mismatch";

export const SIMILAR_THRESHOLD = 0.6;
export const SAME_THRESHOLD = 0.9;
export const DISCLAIMER_OVERLAP = 0.85;

/** Normalised for matching: normalizeArabic + ASCII digits + ة→ه + punctuation removed. */
export const normClaim = (s: string) =>
  normalizeDigits(normalizeArabic(s)).replace(/ة/g, "ه").replace(/[«»"'“”.,،؛:!؟?()\-]/g, " ").replace(/\s+/g, " ").trim();

function trigrams(s: string): Set<string> {
  const t = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
}

/**
 * Similarity of an ad sentence `a` to a library claim `b`: trigram Jaccard (like pg_trgm), or — when the sentence
 * wraps the claim in extra words — 0.85 × the share of the claim's trigrams it contains ("similar wording", never "same").
 */
export function similarity(a: string, b: string): number {
  const x = trigrams(normClaim(a));
  const y = trigrams(normClaim(b));
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const g of x) if (y.has(g)) inter++;
  return Math.max(inter / (x.size + y.size - inter), (0.85 * inter) / y.size);
}

/** Claim candidates: model-detected quotes plus sentences with numbers or superlatives. */
export function claimCandidates(texts: ExtractedText[], modelQuotes: string[] = []): { quote: string; at: ExtractedText | null }[] {
  const out: { quote: string; at: ExtractedText | null }[] = [];
  const seen = new Set<string>();
  const add = (quote: string, at: ExtractedText | null) => {
    const k = normClaim(quote);
    if (k.length < 4 || seen.has(k)) return;
    seen.add(k);
    out.push({ quote: quote.trim(), at });
  };
  for (const t of texts)
    for (const sentence of t.text.split(/[.!؟?\n]+/)) {
      const s = sentence.trim();
      if (!s) continue;
      const n = normalizeArabic(s);
      const hasNumber = extractNumbers(s).some((x) => x.unit === "percent" || x.value >= 1000 || /عميل|عملاء|customers/.test(n));
      if (hasNumber || hit(SUPERLATIVE, n)) add(s, t);
    }
  for (const q of modelQuotes) add(q, texts.find((t) => normClaim(t.text).includes(normClaim(q))) ?? null);
  return out;
}

const inScope = (c: LibClaim, ctx: AnalysisContext, linked: Set<string>) =>
  linked.has(c.id) ||
  ((!c.product_ids.length || (ctx.product !== null && c.product_ids.includes(ctx.product.id))) &&
    (!c.channels.length || ctx.channels.some((x) => c.channels.includes(x))) &&
    (!c.communication_types.length || c.communication_types.includes(ctx.communicationType)));

const numbersOf = (s: string) => extractNumbers(normClaim(s)).map((n) => n.value).sort((a, b) => a - b);

/** Classifies one candidate against the library; null = covered by an approved, in-scope claim. */
export function classifyClaim(quote: string, claims: LibClaim[], ctx: AnalysisContext, linked = new Set<string>()):
  { cls: ClaimClass; claim: LibClaim | null; score: number } | null {
  let best: { claim: LibClaim; score: number } | null = null;
  for (const c of claims) {
    if (c.status === "archived") continue;
    const score = similarity(quote, c.text_ar);
    if (!best || score > best.score || (score === best.score && c.status === "approved")) best = { claim: c, score };
  }
  if (!best || best.score < SIMILAR_THRESHOLD) return { cls: "not_in_library", claim: null, score: best?.score ?? 0 };
  const c = best.claim;
  if (c.status === "expired") return { cls: "expired", claim: c, score: best.score };
  if (c.status !== "approved")
    return { cls: best.score >= SAME_THRESHOLD ? "matching_not_approved" : "similar_wording_not_approved", claim: c, score: best.score };
  const a = numbersOf(quote);
  const b = numbersOf(c.text_ar);
  if (a.length && b.length && JSON.stringify(a) !== JSON.stringify(b)) return { cls: "number_mismatch", claim: c, score: best.score };
  if (!inScope(c, ctx, linked)) return { cls: "out_of_scope", claim: c, score: best.score };
  if (best.score < SAME_THRESHOLD) return { cls: "similar_wording_not_approved", claim: c, score: best.score };
  return null;
}

const MESSAGES: Record<ClaimClass, { ar: string; en: string; fixAr: string }> = {
  not_in_library: { ar: "الادعاء غير موجود في مكتبة الادعاءات المعتمدة.", en: "The claim is not in the approved claims library.", fixAr: "أضف الادعاء مع ما يثبته للاعتماد، أو احذفه من الإعلان." },
  matching_not_approved: { ar: "الادعاء موجود في المكتبة لكنه غير معتمد بعد.", en: "The claim is in the library but not approved yet.", fixAr: "اطلب اعتماد الادعاء قبل النشر." },
  similar_wording_not_approved: { ar: "صياغة الادعاء تختلف عن الصياغة المعتمدة.", en: "The wording differs from the approved claim.", fixAr: "استخدم الصياغة المعتمدة، أو اطلب اعتماد الصياغة الجديدة." },
  out_of_scope: { ar: "الادعاء معتمد لمنتج أو قناة أو نوع اتصال آخر.", en: "The claim is approved for another product, channel or communication type.", fixAr: "وسّع نطاق الادعاء المعتمد أو احذفه من هذا الإعلان." },
  expired: { ar: "انتهت صلاحية اعتماد هذا الادعاء.", en: "This claim's approval has expired.", fixAr: "جدّد اعتماد الادعاء أو احذفه." },
  number_mismatch: { ar: "الرقم في الادعاء يختلف عن الرقم المعتمد.", en: "The figure differs from the approved claim.", fixAr: "استخدم الرقم المعتمد في الادعاء." },
};

export function matchClaims(input: {
  ctx: AnalysisContext; texts: ExtractedText[]; claims: LibClaim[]; linkedClaimIds?: string[]; modelQuotes?: string[];
}): DraftFinding[] {
  const linked = new Set(input.linkedClaimIds ?? []);
  const out: DraftFinding[] = [];
  for (const cand of claimCandidates(input.texts, input.modelQuotes)) {
    const r = classifyClaim(cand.quote, input.claims, input.ctx, linked);
    if (!r) continue;
    const m = MESSAGES[r.cls];
    out.push({
      rule_code: "SYS-CLAIMS",
      finding_type: r.cls === "number_mismatch" ? "confirmed_mismatch" : "needs_evidence",
      severity: "warning",
      confidence: r.cls === "not_in_library" ? 0.7 : 0.9,
      source: "deterministic",
      evidence: { modality: cand.at?.modality ?? "caption", quote: cand.quote.slice(0, 240), t_start: cand.at?.t_start ?? null, t_end: cand.at?.t_end ?? null, page: cand.at?.page ?? null },
      explanation_ar: r.claim && r.cls === "number_mismatch" ? `${m.ar} المعتمد: «${r.claim.text_ar}».` : m.ar,
      explanation_en: m.en,
      suggested_fix_ar: m.fixAr,
      values: { claim_class: r.cls, claim_id: r.claim?.id ?? null, claim_key: r.claim?.claim_key ?? null, claim_version: r.claim?.version ?? null, similarity: Math.round(r.score * 100) / 100 },
    });
  }
  return out;
}

/** A disclaimer is required when its scope matches the context or an applicable rule requires it. */
export function requiredDisclaimers(ds: LibDisclaimer[], ctx: AnalysisContext, applicableCodes: Set<string>): LibDisclaimer[] {
  return ds.filter((d) => {
    if (d.required_by_rule_codes.some((c) => applicableCodes.has(c))) return true;
    if (d.required_by_rule_codes.length) return false;
    return (
      (!d.product_types.length || (ctx.product !== null && d.product_types.includes(ctx.product.productType))) &&
      (!d.channels.length || ctx.channels.some((x) => d.channels.includes(x))) &&
      (!d.communication_types.length || d.communication_types.includes(ctx.communicationType))
    );
  });
}

/** Share of the disclaimer's words found in one text (fuzzy containment). */
export function disclaimerOverlap(disclaimer: string, text: string): number {
  const words = normClaim(disclaimer).split(" ").filter((w) => w.length > 1);
  if (!words.length) return 0;
  const have = new Set(normClaim(text).split(" "));
  return words.filter((w) => have.has(w)).length / words.length;
}

export function checkDisclaimers(ds: LibDisclaimer[], ctx: AnalysisContext, texts: ExtractedText[], applicableCodes: Set<string>): DraftFinding[] {
  const out: DraftFinding[] = [];
  for (const d of requiredDisclaimers(ds, ctx, applicableCodes)) {
    if (texts.some((t) => disclaimerOverlap(d.text_ar, t.text) >= DISCLAIMER_OVERLAP)) continue;
    out.push({
      rule_code: "SYS-DISCLAIMERS",
      finding_type: "missing_required",
      severity: "warning",
      confidence: 0.85,
      source: "deterministic",
      evidence: { modality: "metadata", quote: "", t_start: null, t_end: null },
      explanation_ar: `الإفصاح المعتمد «${d.name || d.text_ar.slice(0, 60)}» غير موجود في الإعلان.`,
      explanation_en: `The approved disclaimer “${d.name || d.text_ar.slice(0, 60)}” is missing.`,
      missing_information_ar: d.text_ar,
      suggested_fix_ar: `أضف الإفصاح بالصياغة المعتمدة: «${d.text_ar}».`,
      values: { disclaimer_id: d.id },
    });
  }
  return out;
}
