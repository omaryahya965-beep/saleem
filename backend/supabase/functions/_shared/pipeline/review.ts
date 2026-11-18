import type { ReviewReason } from "../providers/types.ts";
import type { OverallStatus } from "../types.ts";

export const VISUAL_REVIEW: ReviewReason = {
  ar: "الصور غير متاحة للتحليل؛ يلزم فحص المحتوى المرئي بشرياً.",
  en: "Images are unavailable for analysis; human review of visual content is required.",
};
export const AUDIO_REVIEW: ReviewReason = {
  ar: "بعض الكلام غير واضح أو غير موثوق؛ راجع الصوت والتفريغ بشرياً قبل النشر.",
  en: "Some speech is unclear or unreliable; review the audio and transcript before publishing.",
};

export function reviewReasons(...groups: (ReviewReason[] | undefined)[]): ReviewReason[] {
  const reasons = new Map<string, ReviewReason>();
  for (const reason of groups.flatMap((g) => g ?? [])) reasons.set(`${reason.ar}\n${reason.en}`, reason);
  return [...reasons.values()];
}

/** No findings is not a clean result when required evidence is missing or uncertain. */
export function reviewedStatus(status: OverallStatus, reasons: ReviewReason[]): OverallStatus {
  return status === "ready" && reasons.length ? "review" : status;
}
