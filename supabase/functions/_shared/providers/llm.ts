// supabase/functions/_shared/providers/llm.ts

import type { Finding, RuleRecord, SubmissionData, TranscriptSegment } from "../types.ts";

export interface FrameData {
  t_seconds: number;
  base64?: string;
  image_path?: string;
}

const SYSTEM_PROMPT = `أنت خبير قانوني ومراجع امتثال متخصص في المحتوى الإعلاني والإعلامي السعودي (أنظمة الهيئة العامة لتنظيم الإعلام، نظام التجارة، رخصة موثوق، وضوابط الذكاء الاصطناعي من سدايا).
مهمتك: مراجعة المحتوى المقدم بدقة وفق القواعد المحددة وإرجاع النتائج بتنسيق JSON حصراً.

شروط الإخراج:
- يجب أن يكون الرد عبارة عن كائن JSON صالح فقط دون أي نصوص قبله أو بعده.
- الحقول المطلوبة لكل ملاحظة:
  {
    "rule_code": string, // كود القاعدة المطابقة تماماً
    "severity": "violation" | "warning",
    "t_start": number | null,
    "t_end": number | null,
    "evidence_type": "transcript" | "frame" | "caption" | "metadata",
    "evidence_text": string,
    "explanation_ar": string,
    "explanation_en": string,
    "fix_ar": string,
    "fix_en": string,
    "confidence": number // من 0.1 إلى 1.0
  }
`;

function buildUserPrompt(
  submission: SubmissionData,
  segments: TranscriptSegment[],
  rules: RuleRecord[]
): string {
  const rulesList = rules
    .map(
      (r) =>
        `- [${r.code}] ${r.title_ar} (${r.category}):\n  التعليمات: ${r.llm_instructions}\n  الخطورة الافتراضية: ${r.default_severity}`
    )
    .join("\n\n");

  const transcriptText = segments
    .map((s) => `[${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s]: ${s.text}`)
    .join("\n");

  return `
بيانات المحتوى المطلوب فحصه:
- المنصة: ${submission.platform}
- الفئة / التصنيف: ${submission.product_category}
- نص الوصف / التعليق: ${submission.caption || "(لا يوجد)"}
- إعلان مدفوع: ${submission.is_paid_ad ? "نعم" : "لا"}
- وجود عقد مكتوب: ${submission.has_written_contract ? "نعم" : "لا"}
- استخدام ذكاء اصطناعي: ${submission.ai_used ? "نعم" : "لا"}
- رقم رخصة موثوق: ${submission.mawthooq_license_no || "(غير متوفر)"}

النص المفرّغ من المقطع مع التوقيتات:
${transcriptText || "(لا يوجد تفريغ صوتي)"}

دليل القواعد المعتمد للمطابقة:
${rulesList}

المطلوب:
راجع المحتوى واستخرج الملاحظات والمخالفات المحددة بدقة. أرجع الرد بالصيغة:
{
  "findings": [ ... ]
}
`;
}

export async function runLlmChecks(
  submission: SubmissionData,
  segments: TranscriptSegment[],
  rules: RuleRecord[],
  frames: FrameData[] = [],
  llmModel: string = "claude-3-5-sonnet-20241022"
): Promise<Finding[]> {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  // Fallback to mock findings if no API key is available
  if (!anthropicKey && !openAiKey) {
    console.log("[LlmProvider] Using mock Arabic LLM findings (no API keys configured)");
    return [
      {
        rule_code: "COM-01",
        severity: "violation",
        t_start: 12.0,
        t_end: 24.0,
        evidence_type: "transcript",
        evidence_text: "«هذا الشاي ينحف وتنزلين خمس كيلو في أسبوع ومضمون بدون أعراض جانبية»",
        explanation_ar: "ادعاء صحي مطلق ومضمون النتيجة في إعلان منتج صحي.",
        explanation_en: "Absolute, guaranteed health claim in a health-product ad.",
        fix_ar: "احذف وعود الوزن والضمان، واكتفِ بوصف تجربتك الشخصية دون نتائج مطلقة.",
        fix_en: "Remove weight and guarantee claims; describe your personal experience only.",
        confidence: 0.90,
        source: "llm",
      },
      {
        rule_code: "MAW-02",
        severity: "warning",
        t_start: 24.0,
        t_end: 33.0,
        evidence_type: "transcript",
        evidence_text: "منتج تنحيف (فئة صحية) يُعلن عنه",
        explanation_ar: "منتج صحي يحتاج تأكيد الترخيص الرسمي من الهيئة العامة للغذاء والدواء.",
        explanation_en: "A health product requires confirmation of licensing by SFDA.",
        fix_ar: "تأكد من ترخيص المنتج من هيئة الغذاء والدواء قبل الترويج.",
        fix_en: "Confirm the product is licensed by the SFDA.",
        confidence: 0.60,
        source: "llm",
      },
    ];
  }

  const promptText = buildUserPrompt(submission, segments, rules);

  let rawJson = "";

  if (anthropicKey) {
    // Anthropic Claude
    const contentPayload: unknown[] = [];
    
    // Append frames if available (first 4 frames)
    for (const f of frames.slice(0, 4)) {
      if (f.base64) {
        contentPayload.push({
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: f.base64,
          },
        });
      }
    }
    contentPayload.push({ type: "text", text: promptText });

    const callClaude = async () => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: llmModel,
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: contentPayload }],
        }),
      });
      if (!res.ok) {
        throw new Error(`Anthropic API failed (${res.status}): ${await res.text()}`);
      }
      const data = await res.json();
      return data.content?.[0]?.text || "";
    };

    try {
      rawJson = await callClaude();
    } catch (_err) {
      // Retry once on failure
      rawJson = await callClaude();
    }
  } else if (openAiKey) {
    // OpenAI fallback
    const callOpenAi = async () => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: promptText },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI API failed (${res.status}): ${await res.text()}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    };

    try {
      rawJson = await callOpenAi();
    } catch (_err) {
      rawJson = await callOpenAi();
    }
  }

  // Parse JSON response
  try {
    const cleaned = rawJson.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];

    return rawFindings.map((f: Record<string, unknown>) => ({
      rule_code: String(f.rule_code || "").trim(),
      severity: f.severity === "violation" ? "violation" : "warning",
      t_start: typeof f.t_start === "number" ? f.t_start : null,
      t_end: typeof f.t_end === "number" ? f.t_end : null,
      evidence_type: (["transcript", "frame", "caption", "metadata"].includes(String(f.evidence_type))
        ? f.evidence_type
        : "transcript") as Finding["evidence_type"],
      evidence_text: f.evidence_text ? String(f.evidence_text) : null,
      explanation_ar: String(f.explanation_ar || "ملاحظة تدقيق").trim(),
      explanation_en: f.explanation_en ? String(f.explanation_en).trim() : undefined,
      fix_ar: String(f.fix_ar || "يرجى تعديل المحتوى وفق الدليل").trim(),
      fix_en: f.fix_en ? String(f.fix_en).trim() : undefined,
      confidence: typeof f.confidence === "number" ? f.confidence : 0.75,
      source: "llm" as const,
    }));
  } catch (parseError) {
    console.error("[LlmProvider] JSON parse error, returning empty findings array:", parseError);
    return [];
  }
}
