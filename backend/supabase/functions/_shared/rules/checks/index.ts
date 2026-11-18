// Deterministic check registry (04_AI_PIPELINE §6.1). One function per `rules.deterministic_check` key.
// Checks never read model output, so an ad cannot talk its way out of a missing disclosure.
import type { AnalysisContext, DraftFinding, ExtractedText, FindingType, RuleRow } from "../../types.ts";
import { extractNumbers, normalizeDigits } from "../numbers.ts";
import { normalizeArabic } from "../arabic.ts";
import * as L from "../lexicon/sa_finance.ts";

export interface CheckInput {
  ctx: AnalysisContext;
  texts: ExtractedText[];
  signals: Set<string>;
}

export type CheckResult =
  | { outcome: "passed" }
  | { outcome: "failed"; findings: DraftFinding[] }
  | { outcome: "unable_to_verify"; reason: string };

export type DeterministicCheck = (rule: RuleRow, input: CheckInput) => CheckResult;

const PASSED: CheckResult = { outcome: "passed" };

/** First text whose normalised form matches. */
const find = (texts: ExtractedText[], re: RegExp) => texts.find((t) => L.hit(re, t.norm));

function finding(
  rule: RuleRow,
  type: FindingType,
  msg: { ar: string; en: string; fixAr: string; fixEn: string; missingAr?: string },
  at?: ExtractedText,
  severity = rule.default_severity,
): DraftFinding {
  return {
    rule_code: rule.code,
    finding_type: type,
    severity,
    confidence: 0.9,
    source: "deterministic",
    evidence: at
      ? { modality: at.modality, quote: at.text.slice(0, 240), t_start: at.t_start, t_end: at.t_end, frame_ref: at.frame_ref ?? null, page: at.page ?? null }
      : { modality: "metadata", quote: "", t_start: null, t_end: null },
    explanation_ar: msg.ar,
    explanation_en: msg.en,
    missing_information_ar: msg.missingAr ?? null,
    suggested_fix_ar: msg.fixAr,
    suggested_fix_en: msg.fixEn,
  };
}

const fail = (...findings: DraftFinding[]): CheckResult => ({ outcome: "failed", findings });
const missing = (rule: RuleRow, msg: Parameters<typeof finding>[2], at?: ExtractedText) =>
  fail(finding(rule, rule.finding_type_on_fail ?? "missing_required", msg, at));

/** Arabic letters share among all letters (SAMA-ADV-02). Threshold 0.30. */
export const ARABIC_SHARE_MIN = 0.3;
const arabicLanguageShare: DeterministicCheck = (rule, { texts }) => {
  const all = texts.map((t) => t.text).join(" ");
  const ar = (all.match(/[ء-ي]/g) ?? []).length;
  const latin = (all.match(/[A-Za-z]/g) ?? []).length;
  if (ar + latin === 0) return { outcome: "unable_to_verify", reason: "coverage:no_text" };
  if (ar / (ar + latin) >= ARABIC_SHARE_MIN) return PASSED;
  return missing(rule, {
    ar: "لغة الإعلان ليست العربية في أغلبها.",
    en: "The ad is not mainly in Arabic.",
    fixAr: "اكتب نص الإعلان بالعربية، أو حدّد في السياق أن الإعلان موجّه لغير الناطقين بها.",
    fixEn: "Write the ad in Arabic, or set the audience to non-Arabic speakers in the context.",
  });
};

const institutionIdentity: DeterministicCheck = (rule, { ctx, texts }) => {
  if (!ctx.brandAliases.length) return { outcome: "unable_to_verify", reason: "no_brand_aliases" };
  const aliases = ctx.brandAliases.map(normalizeArabic).filter(Boolean);
  const name = texts.find((t) => aliases.some((a) => t.norm.includes(a)));
  const contact = find(texts, L.CONTACT) ?? texts.find((t) => L.hit(L.CONTACT, normalizeDigits(t.text)));
  if (name && contact) return PASSED;
  const parts = [!name && "اسم المؤسسة", !contact && "وسيلة تواصل"].filter(Boolean).join(" و");
  return missing(rule, {
    ar: `لم يتضمن الإعلان ${parts}.`,
    en: `The ad does not include ${[!name && "the institution name", !contact && "contact details"].filter(Boolean).join(" or ")}.`,
    fixAr: "أضف اسم المؤسسة كما هو مسجل ووسيلة تواصل (رقم هاتف أو موقع إلكتروني).",
    fixEn: "Add the institution's registered name and a contact method (phone number or website).",
    missingAr: parts,
  });
};

const productNamePresent: DeterministicCheck = (rule, { ctx, texts }) => {
  if (!ctx.product) return { outcome: "unable_to_verify", reason: "requires_product" };
  const names = [ctx.product.nameAr, ctx.product.nameEn ?? "", ...ctx.product.aliases].map(normalizeArabic).filter((x) => x.length > 1);
  if (texts.some((t) => names.some((n) => t.norm.includes(n)))) return PASSED;
  return missing(rule, {
    ar: "لم يُذكر اسم المنتج المعلن عنه في الإعلان.",
    en: "The advertised product's name is not mentioned.",
    fixAr: `اذكر اسم المنتج «${ctx.product.nameAr}» بوضوح.`,
    fixEn: `State the product name “${ctx.product.nameEn ?? ctx.product.nameAr}” clearly.`,
  });
};

/** A fee term followed (within 40 characters) by a number. */
function feeWithAmount(t: ExtractedText): boolean {
  const s = normalizeDigits(t.norm);
  const re = new RegExp(L.FEE_TERM.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) if (/\d/.test(s.slice(m.index, m.index + m[0].length + 40))) return true;
  return false;
}

const feesDisclosed: DeterministicCheck = (rule, { ctx, texts }) => {
  // An approved product that explicitly has no fees has nothing to disclose; unknown fees still do.
  const fees = ctx.product?.status === "approved" ? ctx.product.keyFacts.fees : undefined;
  if (Array.isArray(fees) && fees.length === 0) return PASSED;
  const free = find(texts, L.FREE);
  const withAmount = texts.find(feeWithAmount);
  if (!withAmount && !free)
    return missing(rule, {
      ar: "لم يذكر الإعلان الرسوم والعمولات المرتبطة بالمنتج.",
      en: "The ad does not state the product's fees and commissions.",
      fixAr: "اذكر جميع الرسوم والعمولات وقيمها شاملة ضريبة القيمة المضافة.",
      fixEn: "State all fees and commissions with their amounts, including VAT.",
      missingAr: "الرسوم والعمولات",
    });
  if (withAmount && !texts.some((t) => L.hit(L.VAT, t.norm)))
    return missing(
      rule,
      {
        ar: "ذُكرت الرسوم دون بيان أنها شاملة ضريبة القيمة المضافة.",
        en: "Fees are stated without saying whether VAT is included.",
        fixAr: "أضف «شاملة ضريبة القيمة المضافة» بجانب الرسوم.",
        fixEn: "Add “including VAT” next to the fees.",
        missingAr: "بيان ضريبة القيمة المضافة",
      },
      withAmount,
    );
  return PASSED;
};

const SKIP_ABBR = new Set(["SAR", "KSA", "SMS", "URL", "WWW", "PDF", "ATM"]);
const abbreviationsExplained: DeterministicCheck = (rule, { texts }) => {
  const raw = texts.map((t) => t.text).join("\n");
  const tokens = [...new Set(raw.match(/\b[A-Z]{2,5}\b/g) ?? [])].filter((x) => !SKIP_ABBR.has(x));
  const unexplained = tokens.filter((tok) => !new RegExp(`(\\(\\s*${tok}\\s*\\)|\\b${tok}\\s*[(:=])`).test(raw));
  const stars = (raw.match(/\*/g) ?? []).length;
  const footnote = stars === 1 ? ["*"] : [];
  const all = [...unexplained, ...footnote];
  if (!all.length) return PASSED;
  return missing(
    rule,
    {
      ar: `رموز أو اختصارات غير مشروحة: ${all.join("، ")}.`,
      en: `Unexplained abbreviations or symbols: ${all.join(", ")}.`,
      fixAr: "اشرح كل اختصار أو رمز بالعربية في الإعلان نفسه.",
      fixEn: "Explain each abbreviation or symbol in the ad itself.",
      missingAr: all.join("، "),
    },
    texts.find((t) => all.some((a) => t.text.includes(a))),
  );
};

export const FINANCING = new Set([
  "personal_finance", "real_estate_finance", "auto_finance", "credit_card", "bnpl", "sme_finance", "consumer_microfinance", "finance_lease",
]);

/** Percentages within 40 characters after an APR term, per text. */
export function aprMentions(texts: ExtractedText[]): { text: ExtractedText; value: number }[] {
  const out: { text: ExtractedText; value: number }[] = [];
  for (const t of texts) {
    const s = normalizeDigits(t.norm);
    const re = new RegExp(L.APR_TERM.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      const windowEnd = m.index + m[0].length + 40;
      for (const n of extractNumbers(s)) if (n.unit === "percent" && n.index >= m.index && n.index <= windowEnd) out.push({ text: t, value: n.value });
    }
  }
  return out;
}

const aprDisclosure: DeterministicCheck = (rule, { ctx, texts }) => {
  const apr = aprMentions(texts);
  const term = texts.find((t) => extractNumbers(t.norm).some((n) => n.unit === "months" || n.unit === "years"));
  const other = find(texts, L.OTHER_RATE);
  const out: DraftFinding[] = [];
  if (!apr.length && other)
    out.push(finding(rule, "potential_risk", {
      ar: "يعرض الإعلان نسبة ربح أو هامشاً بدلاً من معدل النسبة السنوي.",
      en: "The ad shows a profit or flat rate instead of the annual percentage rate.",
      fixAr: "اعرض معدل النسبة السنوي بدلاً من هامش الربح أو النسبة الثابتة.",
      fixEn: "Show the annual percentage rate instead of the flat or profit rate.",
    }, other));
  else if (!apr.length)
    out.push(finding(rule, "missing_required", {
      ar: "لم يذكر الإعلان معدل النسبة السنوي.",
      en: "The ad does not state the annual percentage rate (APR).",
      fixAr: "أضف «معدل النسبة السنوي X%» بالقيمة المعتمدة للمنتج.",
      fixEn: "Add “APR X%” with the product's approved value.",
      missingAr: "معدل النسبة السنوي",
    }));
  if (!term)
    out.push(finding(rule, "missing_required", {
      ar: "لم يذكر الإعلان مدة التمويل.",
      en: "The ad does not state the finance term.",
      fixAr: "أضف مدة التمويل (مثل «لمدة تصل إلى 60 شهراً»).",
      fixEn: "Add the finance term (e.g. “up to 60 months”).",
      missingAr: "مدة التمويل",
    }));
  if (ctx.product?.productType === "real_estate_finance" && !find(texts, L.FIXED_OR_VARIABLE))
    out.push(finding(rule, "missing_required", {
      ar: "لم يوضح الإعلان هل تكلفة التمويل العقاري ثابتة أم متغيرة.",
      en: "The ad does not say whether the home-finance cost is fixed or variable.",
      fixAr: "وضّح أن معدل التكلفة ثابت أو متغير.",
      fixEn: "State whether the cost rate is fixed or variable.",
      missingAr: "ثبات التكلفة أو تغيرها",
    }));
  return out.length ? fail(...out) : PASSED;
};

const samaSupervisionStatement: DeterministicCheck = (rule, { texts }) =>
  find(texts, L.SUPERVISION)
    ? PASSED
    : missing(rule, {
        ar: "لم يتضمن الإعلان عبارة خضوع المؤسسة لإشراف البنك المركزي السعودي ورقابته.",
        en: "The ad does not state that the institution is supervised by SAMA.",
        fixAr: "أضف عبارة الخضوع لإشراف البنك المركزي السعودي ورقابته بالصياغة التي يعتمدها فريق الالتزام.",
        fixEn: "Add the SAMA supervision statement in the wording approved by your compliance team.",
        missingAr: "عبارة الإشراف والرقابة",
      });

const offerDatesPresent: DeterministicCheck = (rule, { texts }) => {
  const all = texts.map((t) => normalizeDigits(t.norm)).join("\n");
  const dates = all.match(new RegExp(L.DATE.source, "g")) ?? [];
  const bounded = /(حتي|ينتهي|الي|until|ends?)/.test(all);
  if (dates.length >= 2 || (dates.length === 1 && bounded)) return PASSED;
  return missing(rule, {
    ar: "لم يذكر العرض الترويجي تاريخ بدايته ونهايته.",
    en: "The promotional offer does not state its start and end dates.",
    fixAr: "أضف تاريخ بداية العرض ونهايته (مثل «من 1 مارس حتى 31 مارس 2026»).",
    fixEn: "Add the offer's start and end dates.",
    missingAr: "تواريخ العرض",
  }, find(texts, L.PROMO));
};

const samaNameMisuse: DeterministicCheck = (rule, { texts }) => {
  const supervision = new RegExp(L.SUPERVISION.source, "g");
  const misuse = texts.find((t) => L.hit(L.SAMA_NAME, t.norm.replace(supervision, " ")));
  if (!misuse) return PASSED;
  return fail(finding(rule, "potential_risk", {
    ar: "يستخدم الإعلان اسم البنك المركزي السعودي خارج عبارة الإشراف المطلوبة.",
    en: "The ad uses SAMA's name outside the required supervision statement.",
    fixAr: "احذف اسم البنك المركزي أو شعاره من الإعلان، واكتفِ بعبارة الإشراف.",
    fixEn: "Remove SAMA's name or logo; keep only the supervision statement.",
  }, misuse));
};

const fxStatementPresent: DeterministicCheck = (rule, { texts }) =>
  find(texts, L.FX_STATEMENT)
    ? PASSED
    : missing(rule, {
        ar: "التسعير بعملة أجنبية دون بيان أثر سعر الصرف.",
        en: "Foreign-currency pricing without an exchange-rate statement.",
        fixAr: "أضف عبارة واضحة بأن المبلغ قد يتأثر بسعر الصرف.",
        fixEn: "Add a clear statement that the amount may be affected by the exchange rate.",
        missingAr: "بيان أثر سعر الصرف",
      }, find(texts, L.FOREIGN_CURRENCY));

const freeOfferExplicit: DeterministicCheck = (rule, { texts }) => {
  const free = find(texts, L.FREE);
  if (!free || texts.some((t) => L.hit(L.TARGET_GROUP, t.norm))) return PASSED;
  return missing(rule, {
    ar: "يصف الإعلان المنتج بالمجاني أو بدون رسوم دون بيان الفئة المستهدفة.",
    en: "The ad says “free” or “no fees” without stating who it is for.",
    fixAr: "وضّح ما المجاني تحديداً ولمن (مثل «للعملاء الجدد»).",
    fixEn: "State exactly what is free and for whom (e.g. “for new customers”).",
    missingAr: "الفئة المستهدفة بالعرض المجاني",
  }, free);
};

const thirdPartyLicensePresent: DeterministicCheck = (rule, { ctx }) =>
  ctx.creatorLicenseNo?.trim()
    ? PASSED
    : missing(rule, {
        ar: "يُنشر الإعلان عبر صانع محتوى دون رقم ترخيص موثوق.",
        en: "Published through a creator without a Mawthooq licence number.",
        fixAr: "أدخل رقم ترخيص موثوق لصانع المحتوى في سياق الإعلان.",
        fixEn: "Enter the creator's Mawthooq licence number in the ad context.",
        missingAr: "رقم ترخيص صانع المحتوى",
      });

const cmaBenefitDisclosed: DeterministicCheck = (rule, { texts }) =>
  find(texts, L.PAID_PARTNERSHIP)
    ? PASSED
    : missing(rule, {
        ar: "لم يُفصح عن حصول ناشر الإعلان على منفعة.",
        en: "The communicator's benefit is not disclosed.",
        fixAr: "أضف إفصاحاً صريحاً بأن المحتوى إعلان مدفوع.",
        fixEn: "Add an explicit paid-partnership disclosure.",
      });

const pastPerformanceWarning: DeterministicCheck = (rule, { texts }) =>
  find(texts, L.PAST_PERFORMANCE_WARNING)
    ? PASSED
    : missing(rule, {
        ar: "ذُكر الأداء السابق دون تحذير بأنه لا يضمن النتائج المستقبلية.",
        en: "Past performance is shown without a warning that it does not guarantee future results.",
        fixAr: "أضف «الأداء السابق لا يضمن النتائج المستقبلية» ومصدر الأرقام.",
        fixEn: "Add “past performance does not guarantee future results” and the source of the figures.",
      }, find(texts, L.PAST_PERFORMANCE));

const cmaNonRetailToRetail: DeterministicCheck = (rule, { ctx }) => {
  // CMA CMI Article 35: advertisement of non-retail funds or derivatives to retail clients is restricted
  // UNLESS the authorized person has verified product suitability.
  const suitabilityDetermined = Boolean(
    (ctx.product as { key_facts?: { suitability_determined?: boolean } } | undefined)?.key_facts?.suitability_determined
  );
  if (suitabilityDetermined) return PASSED;

  return ctx.audience.includes("general")
    ? fail(finding(rule, "potential_risk", {
        ar: "منتج غير موجّه للأفراد (صناديق خاصة أو مشتقات) يُعلن لجمهور عام دون التحقق من ملاءمة المنتج للعميل (المادة 35 من لائحة مؤسسات السوق المالية).",
        en: "A non-retail product (private fund or derivative) is advertised to a general audience without establishing prior suitability (CMA CMI Art 35).",
        fixAr: "قصر الإعلان على العملاء المؤهلين، أو إثبات التحقق من ملاءمة العميل قبل استهدافه.",
        fixEn: "Restrict the ad to eligible clients or ensure client suitability is verified before targeting.",
      }))
    : PASSED;
};

const injectionAttempt: DeterministicCheck = (rule, { texts }) => {
  const at = find(texts, L.INJECTION);
  if (!at) return PASSED;
  return fail(finding(rule, "potential_risk", {
    ar: "يحتوي الإعلان على تعليمات موجهة إلى أداة الفحص الآلي. لا تؤثر على نتيجة الفحص.",
    en: "The ad contains instructions aimed at the automated checker. They do not change the result.",
    fixAr: "احذف العبارة الموجهة إلى أداة الفحص من محتوى الإعلان.",
    fixEn: "Remove the instruction aimed at the checker from the ad.",
  }, at));
};

export const CHECKS: Record<string, DeterministicCheck> = {
  arabic_language_share: arabicLanguageShare,
  institution_identity: institutionIdentity,
  product_name_present: productNamePresent,
  fees_disclosed: feesDisclosed,
  abbreviations_explained: abbreviationsExplained,
  apr_disclosure: aprDisclosure,
  sama_supervision_statement: samaSupervisionStatement,
  offer_dates_present: offerDatesPresent,
  sama_name_misuse: samaNameMisuse,
  fx_statement_present: fxStatementPresent,
  free_offer_explicit: freeOfferExplicit,
  third_party_license_present: thirdPartyLicensePresent,
  cma_benefit_disclosed: cmaBenefitDisclosed,
  past_performance_warning: pastPerformanceWarning,
  cma_non_retail_to_retail: cmaNonRetailToRetail,
  injection_attempt: injectionAttempt,
};
