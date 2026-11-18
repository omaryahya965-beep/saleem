import { useI18n, type TKey } from "@/i18n";
import { preflightKey } from "@/lib/api/review";
import type { Promotion } from "@/lib/api/promotions";

/** Translates RPC errors / preflight reasons («3 ملاحظات بلا رد»). */
export function usePreflightText() {
  const { t } = useI18n();
  return (r: unknown) => {
    const { key, n } = preflightKey(r);
    const k = `review.preflight.${key}` as TKey;
    const text = t(k, n !== undefined ? { n } : undefined);
    return text === k ? t("review.preflight.generic") : text;
  };
}

/** Hijri (Umm al-Qura) and Gregorian side by side (05_UX_SPEC §5). */
export function bothCalendars(iso: string, lang: "ar" | "en"): string {
  const d = new Date(iso);
  const greg = d.toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const hijri = d.toLocaleDateString(
    `${lang === "ar" ? "ar-SA" : "en"}-u-ca-islamic-umalqura-nu-latn`,
    { dateStyle: "medium" },
  );
  return `${greg} · ${hijri}`;
}

export type QueueTab = "mine" | "unassigned" | "escalation" | "all";

export function filterQueue(items: Promotion[], tab: QueueTab, me: string | null): Promotion[] {
  if (tab === "mine")
    return items.filter((p) => p.assigned_reviewer_id === me || p.escalated_to === me);
  if (tab === "unassigned")
    return items.filter((p) => !p.assigned_reviewer_id && p.review_status !== "escalated");
  if (tab === "escalation") return items.filter((p) => p.review_status === "escalated");
  return items;
}
