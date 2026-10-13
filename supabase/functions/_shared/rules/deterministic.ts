// supabase/functions/_shared/rules/deterministic.ts

import type { Finding, SubmissionData, TranscriptSegment } from "../types.ts";

const DISCLOSURE_PATTERNS = [
  /إعلان/i,
  /اعلان/i,
  /مدفوع/i,
  /برعاية/i,
  /#إعلان/i,
  /#اعلان/i,
  /ad\b/i,
  /#ad\b/i,
  /sponsored/i,
];

const AI_DISCLOSURE_PATTERNS = [
  /ذكاء\s*اصطناعي/i,
  /مولّد/i,
  /معدّل/i,
  /\bai\b/i,
  /#ai\b/i,
];

export function runDeterministicChecks(
  submission: SubmissionData,
  segments: TranscriptSegment[] = []
): Finding[] {
  const findings: Finding[] = [];

  // Extract speech occurring in the first 5 seconds
  const first5SecSpeech = segments
    .filter((s) => s.start <= 5.0)
    .map((s) => s.text)
    .join(" ");

  const caption = submission.caption || "";

  // 1. MAW-01: Ad disclosure check
  if (submission.is_paid_ad) {
    const hasCaptionDisclosure = DISCLOSURE_PATTERNS.some((p) => p.test(caption));
    const hasSpeechDisclosure = DISCLOSURE_PATTERNS.some((p) => p.test(first5SecSpeech));

    if (!hasCaptionDisclosure && !hasSpeechDisclosure) {
      findings.push({
        rule_code: "MAW-01",
        severity: "violation",
        t_start: 0,
        t_end: 5,
        evidence_type: "transcript",
        evidence_text: "لا توجد كلمة «إعلان» في الوصف أو في أول ٥ ثوانٍ رغم وجود إعلان مدفوع",
        explanation_ar: "المحتوى ترويجي (إعلان مدفوع) دون إفصاح صريح عن الإعلان قبل بدايته.",
        explanation_en: "Promotional content without an ad disclosure before it starts.",
        fix_ar: "ابدأ المقطع بعبارة «إعلان مدفوع» وأضف #إعلان في بداية الوصف.",
        fix_en: "Open with \"paid ad\" and add #إعلان at the start of the caption.",
        confidence: 0.95,
        source: "deterministic",
      });
    }
  }

  // 2. MAW-03: Written contract check
  if (submission.is_paid_ad && !submission.has_written_contract) {
    findings.push({
      rule_code: "MAW-03",
      severity: "warning",
      t_start: null,
      t_end: null,
      evidence_type: "metadata",
      evidence_text: "لا يوجد عقد مكتوب مع الماركة",
      explanation_ar: "إعلان مدفوع دون عقد مكتوب مع الجهة المعلنة.",
      explanation_en: "Paid ad without a written contract with the brand.",
      fix_ar: "وثّق الاتفاق مع الماركة كتابياً قبل النشر.",
      fix_en: "Put the brand agreement in writing before publishing.",
      confidence: 0.90,
      source: "deterministic",
    });
  }

  // 3. MAW-04: Mawthooq license check
  if (submission.is_paid_ad && (!submission.mawthooq_license_no || submission.mawthooq_license_no.trim() === "")) {
    findings.push({
      rule_code: "MAW-04",
      severity: "warning",
      t_start: null,
      t_end: null,
      evidence_type: "metadata",
      evidence_text: "لم يُدخل رقم رخصة موثوق",
      explanation_ar: "لم يتم إدخال رقم رخصة موثوق لحساب ينشر إعلاناً تجارياً.",
      explanation_en: "No Mawthooq license number provided for a promotional post.",
      fix_ar: "تحقق من ربط حسابك برخصة موثوق وأدخل رقمها.",
      fix_en: "Verify your account is linked to a Mawthooq license and enter it.",
      confidence: 0.80,
      source: "deterministic",
    });
  }

  // 4. AI-01: AI disclosure check
  if (submission.ai_used) {
    const hasAiCaption = AI_DISCLOSURE_PATTERNS.some((p) => p.test(caption));
    const hasAiSpeech = AI_DISCLOSURE_PATTERNS.some((p) => p.test(first5SecSpeech));

    if (!hasAiCaption && !hasAiSpeech) {
      findings.push({
        rule_code: "AI-01",
        severity: "violation",
        t_start: null,
        t_end: null,
        evidence_type: "metadata",
        evidence_text: "تم تحديد «استخدمت الذكاء الاصطناعي» دون إفصاح في الوصف",
        explanation_ar: "استُخدم الذكاء الاصطناعي في إنشاء المحتوى أو تعديله دون إفصاح واضح.",
        explanation_en: "AI was used without disclosure.",
        fix_ar: "أضف «المحتوى معدّل بالذكاء الاصطناعي» في الوصف.",
        fix_en: "Add \"AI-edited content\" to the caption.",
        confidence: 0.95,
        source: "deterministic",
      });
    }
  }

  return findings;
}
