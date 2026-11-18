// Builds the AnalysisContext (04_AI_PIPELINE §3) and the list of ad texts from database rows. Pure.
import type { AnalysisContext, ExtractedText, OnScreenText, SubmissionData, TranscriptSegment } from "../types.ts";
import type { ProductKeyFacts } from "../products/key-facts.ts";
import { normalizeArabic } from "../rules/arabic.ts";
import { enabledPacksFor } from "../rules/applicability.ts";

export interface PromotionRow {
  id: string;
  org_id: string | null;
  communication_type: AnalysisContext["communicationType"];
  channels: string[];
  distribution: string | null;
  creator_license_no: string | null;
  audience: string[];
  market: string;
  is_paid: boolean | null;
  caption: string | null;
}
export interface ProductRow {
  id: string;
  name_ar: string;
  name_en: string | null;
  aliases: string[];
  sector: string;
  product_type: string;
  regulator: string;
  currency: string;
  status: "draft" | "approved" | "archived";
  key_facts: unknown;
}
export interface PackRow {
  code: string;
  default_sectors: string[];
  enabled_by_default: boolean;
  always_enabled: boolean;
}

export function buildContext(input: {
  submission: SubmissionData & { promotion_id?: string | null; version_no?: number | null; org_id?: string | null };
  promotion: PromotionRow | null;
  product: ProductRow | null;
  orgSettings: { sector: string | null; brand_aliases: string[] } | null;
  packs: PackRow[];
  orgPacks: { pack_code: string; enabled: boolean; include_draft_rules: boolean }[];
}): AnalysisContext {
  const { submission: s, promotion: p, product } = input;
  const orgId = p?.org_id ?? s.org_id ?? null;
  const sector = input.orgSettings?.sector ?? null;
  return {
    submissionId: s.id,
    promotionId: p?.id ?? s.promotion_id ?? null,
    versionNo: s.version_no ?? null,
    orgId,
    sector,
    communicationType: p?.communication_type ?? "creator_sponsored",
    channels: p?.channels?.length ? p.channels : [s.platform],
    distribution: (p?.distribution as AnalysisContext["distribution"]) ?? null,
    creatorLicenseNo: p?.creator_license_no ?? s.mawthooq_license_no ?? null,
    audience: p?.audience?.length ? p.audience : ["general"],
    market: p?.market ?? "SA",
    isPaid: p?.is_paid ?? s.is_paid_ad,
    caption: (s.caption || p?.caption) || null,
    product: product
      ? {
          id: product.id, nameAr: product.name_ar, nameEn: product.name_en, aliases: product.aliases, sector: product.sector,
          productType: product.product_type, regulator: product.regulator, currency: product.currency, status: product.status,
          keyFacts: (product.key_facts ?? {}) as ProductKeyFacts,
        }
      : null,
    brandAliases: input.orgSettings?.brand_aliases ?? [],
    enabledPacks: enabledPacksFor(orgId, product?.sector ?? sector, input.packs, input.orgPacks),
    kind: s.kind,
  };
}

/** Everything the ad says: caption, post text, transcript segments and on-screen text, each with its location. */
export function extractTexts(
  sub: Pick<SubmissionData, "caption" | "kind" | "text_content">,
  segments: TranscriptSegment[],
  onScreen: OnScreenText[],
): ExtractedText[] {
  const out: ExtractedText[] = [];
  const add = (modality: ExtractedText["modality"], text: string, t_start: number | null, t_end: number | null) => {
    const clean = text.trim();
    if (clean) out.push({ modality, text: clean, norm: normalizeArabic(clean), t_start, t_end });
  };
  add("caption", sub.caption ?? "", null, null);
  if (sub.kind === "text") add("caption", sub.text_content ?? "", null, null);
  for (const s of segments) add("speech", s.text, s.start, s.end);
  for (const o of onScreen) add("on_screen_text", o.text, o.t, o.t + 1);
  return out;
}
