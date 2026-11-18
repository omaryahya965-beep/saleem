// Content signals (02_SAUDI_RULES §4). Deterministic signals come from normalised text; model-only
// signals come back in the model output and are accepted only from this fixed list.
import type { AnalysisContext, ExtractedText } from "../types.ts";
import { extractNumbers } from "./numbers.ts";
import * as L from "./lexicon/sa_finance.ts";

export const MODEL_SIGNALS = [
  "banknote_or_coin_image",
  "real_customer_or_testimonial",
  "minors_targeted_or_present",
  "third_party_logo",
] as const;

export function computeSignals(
  texts: ExtractedText[],
  ctx: Pick<AnalysisContext, "product">,
  modelSignals: string[] = [],
): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    const n = t.norm;
    if (L.hit(L.FREE, n)) out.add("mentions_free");
    if (L.hit(L.FOREIGN_CURRENCY, n)) out.add("foreign_currency");
    if (L.hit(L.PROMO, n)) out.add("promo_offer");
    if (L.hit(L.APR_TERM, n) || extractNumbers(t.text).some((x) => x.unit === "percent")) out.add("apr_or_rate_mentioned");
    if (L.hit(L.FEE_TERM, n)) out.add("fees_mentioned");
    if (L.hit(L.ABBREVIATION, t.text)) out.add("abbreviation_present");
    if (L.hit(L.SAMA_NAME, n)) out.add("sama_name_mentioned");
    if (L.hit(L.PAST_PERFORMANCE, n)) out.add("past_performance_mentioned");
    if (L.hit(L.PAID_PARTNERSHIP, n)) out.add("paid_partnership_mentioned");
    if (L.hit(L.SUPERLATIVE, n)) out.add("superlative_or_guarantee");
    if (L.hit(L.CONTEST, n)) out.add("contest_or_prize");
    if (L.hit(L.DISCOUNT, n)) out.add("discount_sale");
    if (L.hit(L.DIRECT_MARKETING, n)) out.add("direct_marketing");
  }
  if (ctx.product && ctx.product.currency !== "SAR") out.add("foreign_currency");
  for (const s of modelSignals) if ((MODEL_SIGNALS as readonly string[]).includes(s)) out.add(s);
  return out;
}
