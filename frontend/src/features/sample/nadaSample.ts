// Public sample: «كريم ندى — Nada Cream» (fictional product), from the manual V2 test of 2026-11-20 (D182).
// Sanitised, static data: no database ids, no storage links, no names. Findings are the rows that run produced
// (rule, severity, source, timestamp, evidence); explanations and fixes are the deterministic engine's own wording.
// Evidence quotes cut at 80 characters in the captured rows end with «…» — nothing was completed or invented.
// Version 1 and 2 were analysed with different Gemini models: this is an illustration, not an accuracy benchmark.
import type { GroupableFinding } from "@/features/reports/grouping";

export interface SampleFinding extends GroupableFinding {
  fix_ar: string;
  fix_en: string;
}
export interface SampleVersion {
  no: number;
  video: string;
  duration: number;
  caption: string;
  transcript: { start: number; end: number; text: string }[];
  findings: SampleFinding[];
  rawCounts: { violations: number; warnings: number };
}

const COM01 = {
  explanation_ar: "ادعاء مطلق بنتيجة مضمونة في محتوى ترويجي.",
  explanation_en: "Absolute, guaranteed-outcome claim in promotional content.",
  fix_ar: "احذف وعد النتيجة المضمونة، واذكر الشروط أو العوامل التي تؤثر في النتيجة.",
  fix_en: "Remove the guaranteed-outcome promise and state the conditions that affect the outcome.",
};
const MAW03 = {
  explanation_ar: "محتوى ترويجي دون عقد أو اتفاق مكتوب مع الجهة المعلنة.",
  explanation_en: "Promotional content without a written agreement with the advertiser.",
  fix_ar: "وثّق الاتفاق مع العلامة كتابياً قبل النشر.",
  fix_en: "Put the brand agreement in writing before publishing.",
};
const MAW04 = {
  explanation_ar: "لم يُدخل رقم رخصة موثوق لحساب ينشر محتوى ترويجياً.",
  explanation_en: "No Mawthooq license number provided for promotional content.",
  fix_ar: "تحقق من ربط حسابك برخصة موثوق وأدخل رقمها.",
  fix_en: "Make sure your account is linked to a Mawthooq license and enter its number.",
};

const f = (
  id: string,
  rule_code: string,
  severity: "violation" | "warning",
  evidence_type: string,
  evidence_text: string,
  t_start: number | null,
  text: { explanation_ar: string; explanation_en: string; fix_ar: string; fix_en: string },
): SampleFinding => ({
  id,
  rule_code,
  severity,
  evidence_type,
  evidence_text,
  t_start,
  status: "open",
  finding_type: null,
  ...text,
});

export const NADA_V1: SampleVersion = {
  no: 1,
  video: "/sample/nada-cream-v1.mp4",
  duration: 15,
  caption: "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنوا…",
  transcript: [
    {
      start: 0,
      end: 5.4,
      text: "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أن…",
    },
    { start: 5.461, end: 10, text: "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية" },
  ],
  findings: [
    f(
      "v1-1",
      "COM-01",
      "violation",
      "transcript",
      "كريم ندى التجريبي يزيل التصبغات تماما خلال ثلاثة أيام فقط والنتيجة مضمونة لكل أن…",
      0,
      COM01,
    ),
    f(
      "v1-2",
      "COM-01",
      "violation",
      "caption",
      "ودّعي التصبغات مع كريم ندى! بشرة صافية خلال 3 أيام فقط، ونتائج مضمونة لجميع أنوا…",
      null,
      COM01,
    ),
    f("v1-3", "COM-01", "violation", "frame", "النتيجة مضمونة خلال ٣ أيام", 11, COM01),
    f(
      "v1-4",
      "COM-01",
      "violation",
      "transcript",
      "والنتيجة مضمونة لكل أنواع البشرة بلا أي آثار جانبية",
      5.461,
      COM01,
    ),
    f("v1-5", "COM-01", "violation", "frame", "النتيجة مضمونة خلال ٣ أيام", 15, COM01),
    f(
      "v1-6",
      "MAW-01",
      "violation",
      "metadata",
      "تم تحديد «إعلان مدفوع»، ولا توجد كلمة «إعلان» في الوصف أو أول 5 ثوانٍ",
      0,
      {
        explanation_ar:
          "المحتوى ترويجي (تم تحديد «إعلان مدفوع») دون إفصاح صريح عن الإعلان في الوصف أو في أول 5 ثوانٍ.",
        explanation_en:
          "Promotional content without a clear ad disclosure in the caption or the first 5 seconds.",
        fix_ar: "ابدأ المقطع بعبارة «إعلان مدفوع» واكتب #إعلان في بداية الوصف.",
        fix_en: 'Open with "paid ad" and put #ad at the start of the caption.',
      },
    ),
    f("v1-7", "MAW-03", "warning", "metadata", "لا يوجد عقد مكتوب مع العلامة", null, MAW03),
    f("v1-8", "MAW-04", "warning", "metadata", "لم يُدخل رقم رخصة موثوق", null, MAW04),
    f(
      "v1-9",
      "AI-01",
      "warning",
      "metadata",
      "تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف",
      null,
      {
        explanation_ar: "استُخدم الذكاء الاصطناعي في إنشاء المحتوى أو تعديله دون إفصاح واضح.",
        explanation_en: "AI was used to create or edit the content without a clear disclosure.",
        fix_ar: "أضف «المحتوى معدّل بالذكاء الاصطناعي» في الوصف أو على الشاشة في البداية.",
        fix_en: 'Add "AI-edited content" to the caption or on screen at the start.',
      },
    ),
  ],
  rawCounts: { violations: 6, warnings: 3 },
};

export const NADA_V2_SCRIPT =
  "إعلان مدفوع. كريم ندى للعناية اليومية بالبشرة. استخدميه وفق تعليمات الاستخدام الموضحة على العبوة. جرّبيه الآن. هذا المحتوى الإعلاني التجريبي مولّد بالذكاء الاصطناعي.";

export const NADA_V2: SampleVersion = {
  no: 2,
  video: "/sample/nada-cream-v2.mp4",
  duration: 15,
  caption: NADA_V2_SCRIPT,
  transcript: [{ start: 0, end: 15, text: NADA_V2_SCRIPT }],
  findings: [
    f("v2-1", "MAW-03", "warning", "metadata", "لا يوجد عقد مكتوب مع العلامة", null, MAW03),
    f("v2-2", "MAW-04", "warning", "metadata", "لم يُدخل رقم رخصة موثوق", null, MAW04),
  ],
  rawCounts: { violations: 0, warnings: 2 },
};

/** Illustrative review workflow (fictional people and dates relative to the test). */
export const SAMPLE_TIMELINE = [
  { key: "created", version: 1 },
  { key: "analysed", version: 1 },
  { key: "submitted", version: 1 },
  { key: "assigned", version: 1 },
  { key: "changes", version: 1 },
  { key: "uploaded", version: 2 },
  { key: "analysed2", version: 2 },
  { key: "returned", version: 2 },
  { key: "conditional", version: 2 },
  { key: "fulfilled", version: 2 },
  { key: "final", version: 2 },
] as const;
