// Saudi finance lexicon (heuristics, refined with tests and the legal reviewer).
// Patterns run on normalizeArabic() output: no hamza seats (أإآ→ا, ئ→ي, ؤ→و), ى→ي, Latin digits,
// lowercase Latin. «ة» is kept by the normaliser, so patterns accept both ة and ه.
// Source: docs/saleem-v2/02_SAUDI_RULES.md §5.2. Patterns without the `g` flag unless noted.

const T = "[ةه]"; // taa marbuta or haa
const NOT_END = "[^.!؟\\n]"; // any character inside the same sentence

/** «خاضع لإشراف ورقابة البنك المركزي السعودي» and close variants (SAMA-ADV-03-9). */
export const SUPERVISION = new RegExp(
  `(خاضع${T}?|تخضع|يخضع)${NOT_END}{0,40}?(لاشراف|لرقاب${T}|اشراف|رقاب${T})${NOT_END}{0,30}?(البنك المركزي السعودي|ساما|sama)`,
);

/** Mention of the central bank (signal sama_name_mentioned, SAMA-ADV-05-3). Global. */
export const SAMA_NAME = new RegExp(`(البنك المركزي السعودي|ساما|\\bsama\\b|مؤسس${T} النقد)`, "g");

/** APR terms (SAMA-ADV-03-8). Global. */
export const APR_TERM = new RegExp(`(معدل النسب${T} السنوي|النسب${T} السنوي${T}|المعدل السنوي|\\bapr\\b)`, "g");
/** Rates other than APR presented as the cost of financing. */
export const OTHER_RATE = new RegExp(
  `(هامش ربح|هامش الربح|نسب${T} ربح ثابت${T}|الربح الثابت|فايد${T} ثابت${T}|flat rate|\\bflat\\b)`,
);
/** Real-estate finance: fixed or variable cost. */
export const FIXED_OR_VARIABLE = new RegExp(`(ثابت${T}?|متغير${T}?)`);

/** Fee terms (SAMA-ADV-03-5). Global. */
export const FEE_TERM = new RegExp(`(رسوم|رسم|عمول${T}|عمولات|\\bfees?\\b)`, "g");
export const VAT = new RegExp(`(ضريب${T} القيم${T} المضاف${T}|\\bvat\\b|شامل${T}? الضريب${T})`);

/** "Free" (signal mentions_free, SAMA-ADV-07). */
export const FREE = /(مجان|بدون (اي )?رسوم|بلا رسوم|صفر رسوم|0 رسوم|\bfree\b)/;
/** Who a free offer is for (SAMA-ADV-07). */
export const TARGET_GROUP =
  /(للعملاء|لعملاء|للموظفين|لموظفي|لحاملي|للمواطنين|للسعوديين|للمقيمين|للطلاب|للعميل|للمشتركين|لفئ|for (new |all )?(customers|employees|students|cardholders))/;

/** Foreign currency near a number (signal foreign_currency). */
export const FOREIGN_CURRENCY = /(\$\s?\d|\d\s?\$|\busd\b|\beur\b|€|£|دولار|يورو|استرليني|درهم|\baed\b)/;
/** Exchange-rate statement (SAMA-ADV-06). */
export const FX_STATEMENT = new RegExp(
  `((يتاثر|تتاثر|تتغير|تختلف)${NOT_END}{0,60}(سعر الصرف|اسعار الصرف|صرف العملات))|exchange rate`,
);

/** Promotional offer (signal promo_offer, SAMA-ADV-04). */
export const PROMO = new RegExp(`(عرض|خصم|لفتر${T} محدود${T}|ينتهي العرض|كاش باك|استرداد نقدي|هدي${T}|cash ?back|\\boffer\\b|discount)`);
/** Dates: dd/mm/yyyy, yyyy-mm-dd, «12 مارس», «1447هـ». Global. */
export const DATE = new RegExp(
  `(\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b|\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b\\d{1,2} ?(يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر|محرم|صفر|ربيع|جمادي|رجب|شعبان|رمضان|شوال|ذو القعد${T}|ذو الحج${T})|\\b1[34]\\d{2} ?ه)`,
  "g",
);

/** Superlatives and guarantees (signal superlative_or_guarantee). */
export const SUPERLATIVE = new RegExp(`(الافضل|الاول|الاقل|الاسرع|رقم 1|الوحيد|مضمون${T}?|بدون مخاطر|100 ?%|\\bbest\\b|\\bguaranteed\\b)`);
/** Past performance (signal past_performance_mentioned, CMA). */
export const PAST_PERFORMANCE = new RegExp(
  `((حقق|حققت|عايد|عوايد|اداء)${NOT_END}{0,30}(العام الماضي|السنوات الماضي${T}|منذ|خلال \\d))|past performance|returned \\d`,
);
export const PAST_PERFORMANCE_WARNING = new RegExp(
  `((الاداء السابق|الاداء الماضي)${NOT_END}{0,40}(لا يضمن|ليس ضمان|لا يعد مؤشر))|past performance (is not|does not)`,
);
/** Paid partnership wording (signal paid_partnership_mentioned, CMA-CMI-33-BENEFIT). */
export const PAID_PARTNERSHIP = new RegExp(`(اعلان مدفوع|شراك${T} مدفوع${T}|برعاي${T}|#اعلان|sponsored|paid partnership)`);

/** Abbreviations in the RAW text: Latin uppercase tokens of 2–5 letters, footnote marks. Global. */
export const ABBREVIATION = /\b[A-Z]{2,5}\b|[*¹²³]/g;
/** Saudi contact patterns (SAMA-ADV-03-1). */
export const CONTACT = /((\+?966|0)5\d{8}|\b9200\d{5}\b|\b920\d{6}\b|\b800\d{7}\b|https?:\/\/|www\.|\.com\b|\.sa\b|تطبيق)/;

/** Instructions aimed at an automated checker (SYS-INJECTION). */
export const INJECTION = new RegExp(
  `((تجاهل|تجاهلي|انس|اهمل)${NOT_END}{0,25}(التعليمات|القواعد|الضوابط|ما سبق))|(اعتبر${NOT_END}{0,20}(الاعلان|المحتوي)${NOT_END}{0,15}(سليم|متوافق|مقبول))|ignore (all |the |any )?(previous |prior )?(instructions|rules)|you are now|system prompt|mark (this|the) ad as (compliant|approved)`,
);

/** Runs a pattern safely whether or not it is global. */
export function hit(re: RegExp, s: string): boolean {
  re.lastIndex = 0;
  const r = re.test(s);
  re.lastIndex = 0;
  return r;
}
