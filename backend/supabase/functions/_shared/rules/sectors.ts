// D213: the sectors an advertisement's CONTENT points to (caption, post text, speech, on-screen text), detected
// deterministically. The analysis applies the rules of the selected sector AND of every detected sector, so a wrong
// (or convenient) sector selection can never hide applicable rules; a mismatch is reported to the user.
import type { ExtractedText } from "../types.ts";
import { normalizeArabic } from "./arabic.ts";

/** Sector vocabulary shared with promotions.sector and rule applicability. */
export const SECTORS = [
  "banking", "finance_company", "payments", "capital_market", "insurance", "cosmetics", "food_beverage",
  "health_supplements", "healthcare", "tourism", "ecommerce", "retail", "real_estate", "general", "other",
] as const;

const KEYWORDS: Record<string, string[]> = {
  // Banking and financing
  banking: ["تمويل", "قرض", "قروض", "بطاقه ائتمان", "بطاقة ائتمان", "بطاقه ائتمانيه", "معدل النسبه السنوي", "نسبه سنويه", "فائده", "مرابحه", "تورق", "بنك", "مصرف", "حساب جاري", "apr", "loan", "credit card", "financing", "mortgage"],
  payments: ["محفظه رقميه", "تحويل اموال", "بطاقه مدفوعه", "استرداد نقدي", "cashback", "wallet", "bnpl", "اشتر الان وادفع لاحقا", "ادفع لاحقا", "تقسيط"],
  capital_market: ["استثمار", "اسهم", "سهم", "محفظه استثماريه", "عوائد مضمونه", "عائد سنوي", "تداول", "صناديق استثمار", "عملات رقميه", "فوركس", "crypto", "forex", "invest", "shares", "trading"],
  insurance: ["تامين", "بوليصه", "وثيقه تامين", "insurance"],
  cosmetics: ["كريم", "بشره", "تصبغات", "تجاعيد", "مكياج", "سيروم", "مستحضر تجميل", "عنايه بالبشره", "تبييض", "skincare", "cream", "serum", "cosmetic"],
  food_beverage: ["مشروب", "عصير", "وجبه", "مطعم", "غذاء", "اطعمه", "قهوه", "شاي", "food", "drink", "restaurant"],
  health_supplements: ["مكمل غذائي", "مكملات", "فيتامين", "بروتين", "تنحيف", "حرق الدهون", "انقاص الوزن", "supplement", "vitamin", "weight loss"],
  healthcare: ["علاج", "دواء", "ادويه", "طبي", "عياده", "مستشفى", "يشفي", "شفاء", "طبيب", "جهاز طبي", "treatment", "clinic", "medicine", "cure"],
  tourism: ["فندق", "منتجع", "رحله", "رحلات", "سياحه", "حجز طيران", "باقه سياحيه", "hotel", "resort", "travel", "tour"],
  real_estate: ["عقار", "شقه", "شقق", "فيلا", "ارض", "اراضي", "وحدات سكنيه", "مخطط", "real estate", "apartment", "villa"],
  ecommerce: ["متجر الكتروني", "تسوق اونلاين", "اطلب الان", "كود خصم", "توصيل مجاني", "online store", "promo code"],
};

// Word-level matching on a folded form (ة→ه as well), so «طبي» never matches inside «طبيعي». A word may carry the
// usual Arabic prefixes (ال، و، ب، ل، ف، وال، بال، لل).
const fold = (s: string) => normalizeArabic(s.toLowerCase()).replace(/ة/g, "ه");
const words = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const PREFIXES = ["", "ال", "و", "ب", "ل", "ف", "وال", "بال", "لل", "فال"];
const NORMALIZED = Object.fromEntries(
  Object.entries(KEYWORDS).map(([sector, list]) => [sector, list.map((w) => words(w))]),
);

/** Sectors whose vocabulary appears in the advertisement (deterministic; no model involved). */
export function detectContentSectors(texts: Pick<ExtractedText, "norm" | "text">[]): string[] {
  const tokens = texts.flatMap((t) => words(t.text || t.norm));
  const at = (i: number, kw: string[]) => kw.every((k, j) => {
    const tok = tokens[i + j];
    return tok !== undefined && (j === 0 ? PREFIXES.some((p) => tok === p + k) : tok === k);
  });
  const found: string[] = [];
  for (const [sector, list] of Object.entries(NORMALIZED))
    if (list.some((kw) => kw.length && tokens.some((_, i) => at(i, kw)))) found.push(sector);
  return found;
}

/** Sectors a selected sector stands for in rule applicability («general»/«other» add nothing). */
export function expandSector(sector: string | null | undefined): string[] {
  if (!sector || sector === "general" || sector === "other") return [];
  return [sector];
}

/**
 * Authorities an advertisement points to, from its sectors (selected and detected) and publication context. Mirrors
 * the SQL recommend_authorities. It only marks relevance in the coverage report: every authority is considered.
 */
export function relevantAuthorities(
  ctx: { channels: string[]; communicationType: string; isPaid: boolean | null },
  sectors: string[],
  aiUsed: boolean,
): string[] {
  const s = new Set(sectors);
  const out = new Set<string>();
  if (ctx.channels.length || ctx.communicationType === "creator_sponsored" || ctx.isPaid) out.add("GMEDIA");
  if (["general_commercial", "creator_sponsored"].includes(ctx.communicationType) || s.has("ecommerce") || s.has("retail")) out.add("MC");
  if (aiUsed) out.add("SDAIA");
  if (["cosmetics", "food_beverage", "health_supplements", "healthcare"].some((x) => s.has(x))) out.add("SFDA");
  if (["banking", "finance_company", "payments"].some((x) => s.has(x)) || ctx.communicationType === "financial_promotion") out.add("SAMA");
  if (s.has("capital_market")) out.add("CMA");
  if (s.has("insurance")) out.add("IA");
  if (s.has("tourism")) out.add("MT");
  if (s.has("real_estate")) out.add("REGA");
  return [...out];
}
