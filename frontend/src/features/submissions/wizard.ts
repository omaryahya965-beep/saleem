// New-advertisement wizard logic (V2 upgrade §4.3, §7, D179). Pure, unit-tested.
import {
  CATEGORY_OF_SECTOR,
  FINANCIAL_SECTORS,
  type CommunicationType,
  type Product,
} from "@/lib/api/promotions";
import type { ProductCategory } from "@/lib/api/data";

export const STEPS = ["content", "details", "context", "review"] as const;
export type Step = (typeof STEPS)[number];

/** Communication type that fits a product: never a financial promotion for a non-financial product. */
export function defaultCommunication(
  product: Pick<Product, "sector"> | null,
  orgSector: string | null,
): CommunicationType {
  const sector = product?.sector ?? orgSector ?? "other";
  return FINANCIAL_SECTORS.has(sector) && product ? "financial_promotion" : "general_commercial";
}

export function categoryFor(product: Pick<Product, "sector"> | null): ProductCategory | null {
  return product ? (CATEGORY_OF_SECTOR[product.sector] ?? "other") : null;
}

export interface WizardState {
  hasOrg: boolean;
  product: Pick<Product, "sector" | "status"> | null;
  communicationType: CommunicationType | null;
  category: ProductCategory;
  channels: string[];
  distribution: string | null;
  isPaid: boolean;
  hasContract: boolean;
  aiUsed: boolean;
  license: string;
}

export type Conflict = { key: string; level: "warning" | "info" | "blocking" };

/** Conflicts and missing context, explained before any AI request is spent (§4.3). */
export function conflicts(s: WizardState): Conflict[] {
  const out: Conflict[] = [];
  const sector = s.product?.sector ?? null;
  const financialProduct = sector !== null && FINANCIAL_SECTORS.has(sector);
  if (s.hasOrg) {
    if (s.channels.length === 0) out.push({ key: "no_channels", level: "blocking" });
    if (!s.product) out.push({ key: "no_product", level: "info" });
    if (s.product && !financialProduct && s.communicationType === "financial_promotion")
      out.push({ key: "financial_comm_for_non_financial", level: "warning" });
    if (financialProduct && s.communicationType === "general_commercial")
      out.push({ key: "general_comm_for_financial", level: "info" });
    if (!s.distribution) out.push({ key: "no_distribution", level: "info" });
    if (s.product?.status === "draft") out.push({ key: "draft_product", level: "info" });
  }
  if (s.product && s.category === "finance" && !financialProduct)
    out.push({ key: "category_mismatch", level: "warning" });
  if (s.product && financialProduct && s.category !== "finance")
    out.push({ key: "category_mismatch", level: "warning" });
  const viaCreator =
    s.distribution === "influencer" || s.communicationType === "creator_sponsored" || !s.hasOrg;
  if (viaCreator && s.isPaid && !s.license.trim())
    out.push({ key: "missing_license", level: "warning" });
  if (viaCreator && s.isPaid && !s.hasContract)
    out.push({ key: "missing_contract", level: "warning" });
  if (s.aiUsed) out.push({ key: "ai_disclosure", level: "info" });
  return out;
}

/** Fields that only matter for creator / influencer publication (Mawthooq licence, written agreement). */
export const showsCreatorFields = (
  s: Pick<WizardState, "hasOrg" | "distribution" | "communicationType">,
) => !s.hasOrg || s.distribution === "influencer" || s.communicationType === "creator_sponsored";

/** The legacy single platform of a version, derived from the channels (one representation). */
export function platformFromChannels<T extends string>(
  channels: string[],
  platforms: readonly T[],
  fallback: T,
): T {
  return (
    (channels.find((c) => (platforms as readonly string[]).includes(c)) as T | undefined) ??
    fallback
  );
}

// ---- Draft recovery (fields only; files are never stored) ----
export interface Draft {
  v: 1;
  step: number;
  kind: string;
  text: string;
  caption: string;
  title: string;
  platform: string;
  category: string;
  isPaidAd: boolean;
  hasContract: boolean;
  aiUsed: boolean;
  license: string;
  orgId: string;
  campaignId: string;
  context: unknown;
  savedAt: string;
}
const key = (userId: string) => `saleem:new-ad-draft:${userId}`;
export function loadDraft(userId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key(userId));
    const d = raw ? (JSON.parse(raw) as Draft) : null;
    // Older than 7 days: dropped.
    return d && d.v === 1 && Date.now() - new Date(d.savedAt).getTime() < 7 * 864e5 ? d : null;
  } catch {
    return null;
  }
}
export function saveDraft(userId: string, d: Omit<Draft, "v" | "savedAt">) {
  try {
    window.localStorage.setItem(
      key(userId),
      JSON.stringify({ ...d, v: 1, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* storage unavailable: no draft recovery */
  }
}
export function clearDraft(userId: string) {
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    /* ignore */
  }
}
