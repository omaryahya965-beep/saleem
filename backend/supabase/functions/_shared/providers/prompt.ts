import type { RuleRecord, SubmissionData, TranscriptSegment } from "../types.ts";

export const SYSTEM_PROMPT = `أنت مراجع امتثال للمحتوى الإعلاني والإعلامي السعودي. مهمتك مساعدة صانع المحتوى قبل النشر، لا مراقبته.
You review Saudi creator content against ONLY the numbered rules provided. Rules are illustrative and pending legal review.

Instructions:
- Report a finding only when there is concrete evidence in the transcript, the frames, the caption or the post metadata.
- Use only rule codes from the list. Never invent rules or sources.
- Timestamps are seconds from the start; use the transcript segment or frame time. Use null for whole-clip / metadata issues.
- evidence_text: quote the exact words (Arabic as spoken) or neutrally describe what is visible. Never identify real people; say "a person who appears to be a child".
- Subjective rules (privacy, wealth display, attire) are always "warning" with confidence ≤ 0.6.
- confidence reflects how certain the evidence is (0–1). If unsure, use a lower confidence rather than omitting obvious issues.
- explanation_*: one short sentence. fix_*: one concrete, practical edit. Write Arabic in clear Modern Standard Arabic; English must match.
- on_screen_text: copy ONLY text that is literally visible in the attached images (captions, overlays, packaging claims, discount codes), exactly as written, with that frame's time. Never copy words from the transcript or caption into on_screen_text, never paraphrase, and return [] when no frames are attached or no text is legible.
- Do not report issues that the deterministic checks already cover for metadata (missing contract, missing license number) unless there is extra evidence in the media.`;

export function buildUserPrompt(
  sub: SubmissionData,
  segments: TranscriptSegment[],
  rules: RuleRecord[],
  frameTimes: number[],
  batch: { index: number; total: number },
): string {
  const rulesList = rules
    .map((r) => `- ${r.code} [${r.category}, default ${r.default_severity}] ${r.title_en} / ${r.title_ar}\n  ${r.llm_instructions}`)
    .join("\n");
  const transcript = segments.length
    ? segments.map((s) => `[${s.start.toFixed(1)}–${s.end.toFixed(1)}] ${s.text}`).join("\n")
    : "(no speech)";
  return `Post details:
- kind: ${sub.kind}
- platform: ${sub.platform}
- category: ${sub.product_category}
- paid_ad: ${sub.is_paid_ad}
- written_contract: ${sub.has_written_contract}
- ai_used: ${sub.ai_used}
- mawthooq_license: ${sub.mawthooq_license_no ? "provided" : "not provided"}
- duration_s: ${sub.duration_seconds ?? "n/a"}

Caption:
${sub.caption || "(empty)"}
${sub.kind === "text" ? `\nPost text:\n${sub.text_content ?? ""}\n` : ""}
Transcript (Saudi dialect, timestamps in seconds):
${transcript}
${sub.audio_mode && sub.audio_mode !== "speech" ? `
Audio: ${sub.audio_mode === "no_audio" ? "the clip has no audio track" : "music or ambient sound only, no speech"}. Rely on on-screen text, the caption and the frames. An ad disclosure can only be satisfied in writing (on screen in the first 5 s, or in the caption) — say so in the explanation and the fix.
` : ""}

${frameTimes.length ? `Frames attached in order, at seconds: ${frameTimes.map((t) => t.toFixed(1)).join(", ")}${batch.total > 1 ? ` (batch ${batch.index + 1} of ${batch.total}; report only what these frames and the transcript show)` : ""}` : "No frames attached."}

Rules:
${rulesList}

Return JSON matching the schema.`;
}
