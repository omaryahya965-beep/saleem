// Deterministic (rule-based) checks over transcript, on-screen text, caption and post metadata.
// These never call a model; they are cheap, explainable and unit-tested with Arabic fixtures.

import type { Finding, OnScreenText, SubmissionData, TranscriptSegment } from "../types.ts";
import { normalizeArabic } from "./arabic.ts";

/** Window (seconds) in which a spoken/on-screen disclosure counts as "before the ad". */
export const DISCLOSURE_WINDOW_S = 5;

// Patterns operate on normalizeArabic() output and must be written in that form:
// no hamza seats (أإآ→ا, ئ→ي, ؤ→و), ى→ي, Latin digits, lowercase.
export const DISCLOSURE_PATTERNS: RegExp[] = [
  /اعلان/,
  /مدفوع/,
  /برعايه|برعاية/,
  /شراكه مدفوعه|شراكة مدفوعة/,
  /(^|[\s#])ad(\b|$)/,
  /#ad\b/,
  /sponsored/,
  /paid (partnership|promotion)/,
];

export const AI_DISCLOSURE_PATTERNS: RegExp[] = [
  /ذكاء\s*اصطناعي/,
  /الذكاء\s*الاصطناعي/,
  /مولد/,
  /معدل/,
  /(^|[\s#])ai(\b|$)/,
  /ai[-\s]?(generated|edited)/,
];

/** `(كود|كوبون|code|خصم)\s*[:：]?\s*[A-Za-z0-9]{3,}` — run on raw text (case-sensitive code capture). */
export const DISCOUNT_CODE = /(كود|كوبون|code|خصم)\s*[:：]?\s*([A-Za-z0-9]{3,})/i;

export const PROMO_PATTERNS: RegExp[] = [
  /الرابط (في|ف) (البايو|البروفايل)/,
  /اللينك (في|ف) (البايو|البروفايل)/,
  /link in bio/,
  /اطلب(وا|ي)? (الحين|الان|من)/,
  /استخدم(وا|ي)? (الكود|كود)/,
  /(متوفر|متوفره) (في|عند)/,
  /سارع(وا)?/,
  /عرض (خاص|لفتره|لفترة)/,
];

const NUM_WORD = "(\\d+|واحد|اثنين|ثنين|ثلاث|اربع|خمس|ست|سبع|ثمان|تسع|عشر)[^\\s]*";

/** Health and financial absolute claims (COM-01). Each has a key used in tests. */
export const CLAIM_PATTERNS: { key: string; kind: "health" | "finance"; re: RegExp }[] = [
  { key: "slimming", kind: "health", re: /ينحف|يحرق الدهون|يذوب الدهون/ },
  { key: "weight_loss", kind: "health", re: new RegExp(`تنزل(ين|ون|ي)?\\s*${NUM_WORD}\\s*(كيلو|كيلوات|كيلوهات|كغ|kg)`) },
  { key: "cures", kind: "health", re: /(يعالج|تعالج|يشفي|تشفي)|علاج نهايي|شفاء تام/ },
  { key: "guaranteed", kind: "health", re: /مضمون|مضمونه|مضمونة|نتيجه مضمونه|ضمان ?100/ },
  { key: "no_side_effects", kind: "health", re: /بدون (اي )?اعراض جانبيه|بدون (اي )?اعراض جانبية|ما له اعراض جانبيه|ما له اعراض جانبية/ },
  { key: "guaranteed_profit", kind: "finance", re: /ربح مضمون|ارباح مضمونه|ارباح مضمونة|عايد مضمون/ },
  { key: "daily_return", kind: "finance", re: /عايد يومي|ارباح يوميه|ارباح يومية|دخل يومي مضمون/ },
];

interface TextSpan {
  t_start: number | null;
  t_end: number | null;
  raw: string;
  norm: string;
  evidence_type: "transcript" | "frame" | "caption";
}

function spans(sub: SubmissionData, segments: TranscriptSegment[], onScreen: OnScreenText[]): TextSpan[] {
  const out: TextSpan[] = [];
  for (const s of segments) out.push({ t_start: s.start, t_end: s.end, raw: s.text, norm: normalizeArabic(s.text), evidence_type: "transcript" });
  for (const o of onScreen) out.push({ t_start: o.t, t_end: o.t + 1, raw: o.text, norm: normalizeArabic(o.text), evidence_type: "frame" });
  const caption = [sub.caption, sub.kind === "text" ? sub.text_content ?? "" : ""].filter(Boolean).join("\n");
  if (caption) out.push({ t_start: null, t_end: null, raw: caption, norm: normalizeArabic(caption), evidence_type: "caption" });
  return out;
}

const any = (patterns: RegExp[], s: string) => patterns.some((p) => p.test(s));

function quote(raw: string, max = 140): string {
  const t = raw.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export interface DeterministicResult {
  findings: Finding[];
  /** True when the content looks promotional (paid flag, discount code or promo phrase). */
  promotional: boolean;
  discountCodes: string[];
}

export function runDeterministicChecks(
  submission: SubmissionData,
  segments: TranscriptSegment[] = [],
  onScreen: OnScreenText[] = [],
): DeterministicResult {
  const findings: Finding[] = [];
  const all = spans(submission, segments, onScreen);
  const caption = all.find((s) => s.evidence_type === "caption");
  const early = all.filter((s) => s.evidence_type !== "caption" && s.t_start !== null && s.t_start < DISCLOSURE_WINDOW_S);

  // --- Promotional signals ---------------------------------------------------
  const codeHits: { span: TextSpan; code: string }[] = [];
  for (const s of all) {
    const m = DISCOUNT_CODE.exec(s.raw);
    if (m?.[2]) codeHits.push({ span: s, code: m[2] });
  }
  const promoHits = all.filter((s) => any(PROMO_PATTERNS, s.norm));
  const promotional = submission.is_paid_ad || codeHits.length > 0 || promoHits.length > 0;

  // --- MAW-01: disclosure in caption or within the first 5 s (speech or on-screen) ----------
  const disclosed =
    (caption ? any(DISCLOSURE_PATTERNS, caption.norm) : false) || early.some((s) => any(DISCLOSURE_PATTERNS, s.norm));
  if (promotional && !disclosed) {
    const trigger = codeHits[0]?.span ?? promoHits[0];
    const reason = submission.is_paid_ad
      ? "تم تحديد «إعلان مدفوع»"
      : codeHits[0]
        ? `كود خصم «${codeHits[0].code}»`
        : "عبارة ترويجية";
    findings.push({
      rule_code: "MAW-01",
      severity: "violation",
      t_start: 0,
      t_end: DISCLOSURE_WINDOW_S,
      evidence_type: trigger?.evidence_type ?? "metadata",
      evidence_text: trigger ? quote(trigger.raw) : `${reason}، ولا توجد كلمة «إعلان» في الوصف أو أول ${DISCLOSURE_WINDOW_S} ثوانٍ`,
      explanation_ar: `المحتوى ترويجي (${reason}) دون إفصاح صريح عن الإعلان في الوصف أو في أول ${DISCLOSURE_WINDOW_S} ثوانٍ.`,
      explanation_en: `Promotional content without a clear ad disclosure in the caption or the first ${DISCLOSURE_WINDOW_S} seconds.`,
      fix_ar: "ابدأ المقطع بعبارة «إعلان مدفوع» واكتب #إعلان في بداية الوصف.",
      fix_en: 'Open with "paid ad" and put #ad at the start of the caption.',
      confidence: 0.95,
      source: "deterministic",
    });
  }

  // --- COM-01: absolute health / finance claims --------------------------------------------
  for (const s of all) {
    for (const c of CLAIM_PATTERNS) {
      if (!c.re.test(s.norm)) continue;
      const strong = promotional;
      findings.push({
        rule_code: "COM-01",
        severity: strong ? "violation" : "warning",
        t_start: s.t_start,
        t_end: s.t_end,
        evidence_type: s.evidence_type,
        evidence_text: quote(s.raw),
        explanation_ar:
          c.kind === "health"
            ? "ادعاء صحي مطلق أو مضمون النتيجة في محتوى ترويجي."
            : "ادعاء مالي بعائد أو ربح مضمون في محتوى ترويجي.",
        explanation_en:
          c.kind === "health"
            ? "Absolute or guaranteed health claim in promotional content."
            : "Guaranteed financial return claim in promotional content.",
        fix_ar:
          c.kind === "health"
            ? "احذف وعود النتائج والضمان، واكتفِ بوصف تجربتك الشخصية مع توضيح أن النتائج تختلف."
            : "احذف وعود الربح المضمون، وأضف تنبيهاً واضحاً بالمخاطر.",
        fix_en:
          c.kind === "health"
            ? "Remove result and guarantee promises; describe your personal experience and note results vary."
            : "Remove guaranteed-profit promises and add a clear risk notice.",
        confidence: strong ? 0.9 : 0.65,
        source: "deterministic",
      });
      break; // one COM-01 per span
    }
  }

  // --- Metadata rules -------------------------------------------------------------------------
  if (promotional && !submission.has_written_contract) {
    findings.push({
      rule_code: "MAW-03",
      severity: "warning",
      t_start: null,
      t_end: null,
      evidence_type: "metadata",
      evidence_text: "لا يوجد عقد مكتوب مع العلامة",
      explanation_ar: "محتوى ترويجي دون عقد أو اتفاق مكتوب مع الجهة المعلنة.",
      explanation_en: "Promotional content without a written agreement with the advertiser.",
      fix_ar: "وثّق الاتفاق مع العلامة كتابياً قبل النشر.",
      fix_en: "Put the brand agreement in writing before publishing.",
      confidence: 0.9,
      source: "deterministic",
    });
  }

  if (promotional && !submission.mawthooq_license_no?.trim()) {
    findings.push({
      rule_code: "MAW-04",
      severity: "warning",
      t_start: null,
      t_end: null,
      evidence_type: "metadata",
      evidence_text: "لم يُدخل رقم رخصة موثوق",
      explanation_ar: "لم يُدخل رقم رخصة موثوق لحساب ينشر محتوى ترويجياً.",
      explanation_en: "No Mawthooq license number provided for promotional content.",
      fix_ar: "تحقق من ربط حسابك برخصة موثوق وأدخل رقمها.",
      fix_en: "Make sure your account is linked to a Mawthooq license and enter its number.",
      confidence: 0.8,
      source: "deterministic",
    });
  }

  if (submission.ai_used) {
    const aiDisclosed =
      (caption ? any(AI_DISCLOSURE_PATTERNS, caption.norm) : false) || early.some((s) => any(AI_DISCLOSURE_PATTERNS, s.norm));
    if (!aiDisclosed) {
      findings.push({
        rule_code: "AI-01",
        severity: "violation",
        t_start: null,
        t_end: null,
        evidence_type: "metadata",
        evidence_text: "تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف",
        explanation_ar: "استُخدم الذكاء الاصطناعي في إنشاء المحتوى أو تعديله دون إفصاح واضح.",
        explanation_en: "AI was used to create or edit the content without a clear disclosure.",
        fix_ar: "أضف «المحتوى معدّل بالذكاء الاصطناعي» في الوصف أو على الشاشة في البداية.",
        fix_en: 'Add "AI-edited content" to the caption or on screen at the start.',
        confidence: 0.95,
        source: "deterministic",
      });
    }
  }

  return { findings, promotional, discountCodes: [...new Set(codeHits.map((c) => c.code))] };
}
