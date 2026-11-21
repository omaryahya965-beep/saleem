import type { StudioBrief } from "@/lib/api/studio";

/** Disclosures the Studio adds for this context (mirrors the backend rule). */
export function disclosuresFor(b: StudioBrief): string[] {
  const ar = b.language === "ar";
  const paid =
    b.context.is_paid ||
    b.context.communication_type !== "general_commercial" ||
    b.context.publisher !== "owned";
  return [
    paid ? (ar ? "إعلان مدفوع" : "Paid advertisement") : ar ? "إعلان" : "Advertisement",
    ar ? "محتوى معدّ بمساعدة الذكاء الاصطناعي" : "Content prepared with AI assistance",
  ];
}
