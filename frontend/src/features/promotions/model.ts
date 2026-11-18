import type { StatusTone } from "@/components/ui";
import type { TKey } from "@/i18n";
import type { CommunicationType, PromotionContext, VersionSummary } from "@/lib/api/promotions";

/** Automated-result chip for a version (05_UX_SPEC §6.2 labels; never "compliant"). */
export function resultOf(v: Pick<VersionSummary, "status" | "overall_status"> | null): {
  tone: StatusTone;
  key: TKey;
} | null {
  if (!v) return null;
  if (v.status === "failed") return { tone: "neutral", key: "promo.result.failed" };
  if (v.status !== "done") return { tone: "processing", key: "promo.result.processing" };
  if (v.overall_status === "needs_fixes")
    return { tone: "violation", key: "promo.result.needs_fixes" };
  if (v.overall_status === "review") return { tone: "warning", key: "promo.result.review" };
  return { tone: "ready", key: "promo.result.ready" };
}

/** Picks the version for `?v=N`; falls back to the latest (and says so). */
export function pickVersion(
  versions: VersionSummary[],
  v: number | undefined,
): { version: VersionSummary | null; missing: boolean } {
  const latest = versions.at(-1) ?? null;
  if (v === undefined) return { version: latest, missing: false };
  const found = versions.find((x) => x.version_no === v);
  return { version: found ?? latest, missing: !found };
}

export type ContextValue = Omit<PromotionContext, "title" | "orgId" | "campaignId" | "caption">;

export const emptyContext = (communicationType: CommunicationType): ContextValue => ({
  productId: null,
  channels: [],
  communicationType,
  audience: ["general"],
  isPaid: null,
  distribution: null,
  creatorLicenseNo: null,
  reviewerNotes: null,
  deadlineAt: null,
});
