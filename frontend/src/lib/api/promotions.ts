// v2 data access: promotions (إعلانات) with numbered versions, products and org settings.
// Reads go through RLS; status/approval fields change only through RPCs (see migrations v2_*).
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import type { ProductKeyFacts } from "@/lib/key-facts";
import { ApiError, type Submission } from "./data";

type Tables = Database["public"]["Tables"];
export type Promotion = Tables["promotions"]["Row"];
export type Product = Tables["products"]["Row"];
export type OrgSettings = Tables["org_settings"]["Row"];
export type ReviewStatus = Database["public"]["Enums"]["promotion_review_status"];
export type CommunicationType = Database["public"]["Enums"]["communication_type"];

export const REVIEW_STATUSES: ReviewStatus[] = [
  "draft",
  "pending_review",
  "in_review",
  "changes_requested",
  "conditionally_approved",
  "approved",
  "rejected",
  "escalated",
  "withdrawn",
  "archived",
];
export const COMMUNICATION_TYPES: CommunicationType[] = [
  "financial_promotion",
  "general_commercial",
  "creator_sponsored",
  "internal",
];
export const CHANNELS = [
  "snapchat",
  "tiktok",
  "instagram",
  "x",
  "youtube",
  "website",
  "app",
  "email",
  "sms",
  "branch",
  "outdoor",
  "tv_radio",
  "print",
] as const;
export const AUDIENCES = ["general", "youth", "professionals", "high_net_worth", "sme"] as const;
export const DISTRIBUTIONS = ["owned", "paid_media", "influencer"] as const;
/** D170: financial sectors plus non-financial industries (extensible: add a sector + its product types). */
export const SECTORS = [
  "banking",
  "finance_company",
  "payments",
  "capital_market",
  "insurance",
  "cosmetics",
  "food_beverage",
  "health_supplements",
  "tourism",
  "ecommerce",
  "retail",
  "other",
] as const;
export const REGULATORS = ["SAMA", "CMA", "IA", "SFDA", "MOT", "MOC", "other"] as const;
export const PRODUCT_TYPES = [
  "personal_finance",
  "real_estate_finance",
  "auto_finance",
  "credit_card",
  "bnpl",
  "sme_finance",
  "consumer_microfinance",
  "finance_lease",
  "current_account",
  "savings_deposit",
  "time_deposit",
  "wallet",
  "prepaid_card",
  "remittance",
  "fx",
  "public_fund",
  "non_retail_fund",
  "equities",
  "derivatives",
  "sukuk_bonds",
  "robo_advisory",
  "insurance_motor",
  "insurance_health",
  "insurance_protection_savings",
  "insurance_other",
  "skincare",
  "makeup",
  "haircare",
  "fragrance",
  "personal_care",
  "food_product",
  "beverage",
  "dietary_supplement",
  "health_product",
  "tour_package",
  "accommodation",
  "experience",
  "travel_service",
  "online_product",
  "retail_product",
  "electronics",
  "apparel",
  "service",
  "other",
] as const;
export type Sector = (typeof SECTORS)[number];
export type ProductType = (typeof PRODUCT_TYPES)[number];
/** Product types offered per sector (the form shows only these) and the default regulator. */
export const SECTOR_MODEL: Record<
  Sector,
  {
    types: ProductType[];
    regulator: (typeof REGULATORS)[number];
    fields: "financial" | "cosmetics" | "food_health" | "tourism" | "retail" | "basic";
  }
> = {
  banking: {
    types: [
      "personal_finance",
      "real_estate_finance",
      "auto_finance",
      "credit_card",
      "sme_finance",
      "current_account",
      "savings_deposit",
      "time_deposit",
      "prepaid_card",
      "remittance",
      "fx",
      "other",
    ],
    regulator: "SAMA",
    fields: "financial",
  },
  finance_company: {
    types: [
      "personal_finance",
      "real_estate_finance",
      "auto_finance",
      "bnpl",
      "sme_finance",
      "consumer_microfinance",
      "finance_lease",
      "credit_card",
      "other",
    ],
    regulator: "SAMA",
    fields: "financial",
  },
  payments: {
    types: ["wallet", "prepaid_card", "remittance", "bnpl", "fx", "other"],
    regulator: "SAMA",
    fields: "financial",
  },
  capital_market: {
    types: [
      "public_fund",
      "non_retail_fund",
      "equities",
      "derivatives",
      "sukuk_bonds",
      "robo_advisory",
      "other",
    ],
    regulator: "CMA",
    fields: "financial",
  },
  insurance: {
    types: [
      "insurance_motor",
      "insurance_health",
      "insurance_protection_savings",
      "insurance_other",
    ],
    regulator: "IA",
    fields: "financial",
  },
  cosmetics: {
    types: ["skincare", "makeup", "haircare", "fragrance", "personal_care", "other"],
    regulator: "SFDA",
    fields: "cosmetics",
  },
  food_beverage: {
    types: ["food_product", "beverage", "other"],
    regulator: "SFDA",
    fields: "food_health",
  },
  health_supplements: {
    types: ["dietary_supplement", "health_product", "other"],
    regulator: "SFDA",
    fields: "food_health",
  },
  tourism: {
    types: ["tour_package", "accommodation", "experience", "travel_service", "other"],
    regulator: "MOT",
    fields: "tourism",
  },
  ecommerce: {
    types: ["online_product", "electronics", "apparel", "service", "other"],
    regulator: "MOC",
    fields: "retail",
  },
  retail: {
    types: ["retail_product", "electronics", "apparel", "service", "other"],
    regulator: "MOC",
    fields: "retail",
  },
  other: { types: ["service", "other"], regulator: "other", fields: "basic" },
};
/** Legacy v1 content category for a sector (kept on each version for the v1 checks). */
export const CATEGORY_OF_SECTOR: Record<
  string,
  "food" | "health" | "beauty" | "finance" | "real_estate" | "other"
> = {
  banking: "finance",
  finance_company: "finance",
  payments: "finance",
  capital_market: "finance",
  insurance: "finance",
  cosmetics: "beauty",
  food_beverage: "food",
  health_supplements: "health",
  tourism: "other",
  ecommerce: "other",
  retail: "other",
  other: "other",
};
/** States in which context can be edited and a new version uploaded (mirrors `promotion_is_open`). */
export const OPEN_STATUSES = new Set<ReviewStatus>([
  "draft",
  "changes_requested",
  "rejected",
  "conditionally_approved",
]);
export const FINANCIAL_SECTORS = new Set([
  "banking",
  "finance_company",
  "payments",
  "capital_market",
  "insurance",
]);

function check<T>(res: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (res.error) {
    const notFound = res.error.code === "PGRST116";
    throw Object.assign(new ApiError(res.error.message, notFound ? "not_found" : "unknown"), {
      sqlCode: res.error.code,
    });
  }
  return res.data as NonNullable<T>;
}

/** Extracts a `code:<key>` token raised by the database, if any. */
export function dbErrorCode(e: unknown): string | null {
  const msg = (e as { message?: string })?.message ?? "";
  return /code:([a-z_]+)/.exec(msg)?.[1] ?? null;
}

// ---------------------------------------------------------------- promotions

export type VersionSummary = Pick<
  Submission,
  | "id"
  | "version_no"
  | "status"
  | "overall_status"
  | "kind"
  | "created_at"
  | "analyzed_at"
  | "title"
  | "user_id"
>;

export interface PromotionListItem extends Promotion {
  current: VersionSummary | null;
  product: Pick<Product, "id" | "name_ar" | "name_en" | "status"> | null;
}

export interface PromotionFilters {
  status?: ReviewStatus | "";
  productId?: string;
  channel?: string;
  communicationType?: CommunicationType | "";
  q?: string;
  orgId?: string;
}

const VERSION_COLS =
  "id, version_no, status, overall_status, kind, created_at, analyzed_at, title, user_id";

export async function listPromotions(f: PromotionFilters = {}): Promise<PromotionListItem[]> {
  let q = supabase
    .from("promotions")
    .select("*")
    .eq("is_demo", false)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (f.status) q = q.eq("review_status", f.status);
  if (f.productId) q = q.eq("product_id", f.productId);
  if (f.channel) q = q.contains("channels", [f.channel]);
  if (f.communicationType) q = q.eq("communication_type", f.communicationType);
  if (f.orgId) q = q.eq("org_id", f.orgId);
  const term = f.q?.trim();
  if (term) {
    const uuid = /^[0-9a-f-]{36}$/i.test(term);
    q = uuid ? q.eq("id", term) : q.ilike("title", `%${term.replace(/[%_,()]/g, " ")}%`);
  }
  const promos = check(await q) as Promotion[];
  const versionIds = promos.map((p) => p.current_version_id).filter((x): x is string => Boolean(x));
  const productIds = [
    ...new Set(promos.map((p) => p.product_id).filter((x): x is string => Boolean(x))),
  ];
  const [versions, products] = await Promise.all([
    versionIds.length
      ? supabase.from("submissions").select(VERSION_COLS).in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    productIds.length
      ? supabase.from("products").select("id, name_ar, name_en, status").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const vmap = new Map((check(versions) as VersionSummary[]).map((v) => [v.id, v]));
  const pmap = new Map((check(products) as PromotionListItem["product"][]).map((p) => [p!.id, p]));
  return promos.map((p) => ({
    ...p,
    current: (p.current_version_id && vmap.get(p.current_version_id)) || null,
    product: (p.product_id && pmap.get(p.product_id)) || null,
  }));
}

export interface PromotionBundle {
  promotion: Promotion;
  versions: VersionSummary[];
  product: Product | null;
  /** Null when absent or not readable by the caller (RLS). */
  campaign?: { id: string; name: string; brand: string | null } | null;
  /** Display names of the organisation members the caller may read (creator, reviewer…). */
  people?: Record<string, { name: string; role: string }>;
}

export async function getPromotion(id: string): Promise<PromotionBundle> {
  const [promotion, versions] = await Promise.all([
    supabase.from("promotions").select("*").eq("id", id).single(),
    supabase.from("submissions").select(VERSION_COLS).eq("promotion_id", id).order("version_no"),
  ]);
  const p = check(promotion) as Promotion;
  const product = p.product_id
    ? (check(
        await supabase.from("products").select("*").eq("id", p.product_id).maybeSingle(),
      ) as Product | null)
    : null;
  const [campaign, members] = await Promise.all([
    p.campaign_id
      ? supabase.from("campaigns").select("id, name, brand").eq("id", p.campaign_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    p.org_id
      ? supabase
          .from("org_members")
          .select("user_id, display_name, email, role")
          .eq("org_id", p.org_id)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const people: Record<string, { name: string; role: string }> = {};
  for (const m of (members.data ?? []) as {
    user_id: string;
    display_name: string | null;
    email: string | null;
    role: string;
  }[])
    people[m.user_id] = { name: m.display_name || m.email || "—", role: m.role };
  return {
    promotion: p,
    versions: check(versions) as VersionSummary[],
    product: product ?? null,
    campaign: (campaign.data as PromotionBundle["campaign"]) ?? null,
    people,
  };
}

/** Where `/checks/$id` should land: the version's promotion and number (null for unknown rows). */
export async function versionLocation(
  submissionId: string,
): Promise<{ promotionId: string; versionNo: number } | null> {
  const { data, error } = await supabase
    .from("submissions")
    .select("promotion_id, version_no")
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !data?.promotion_id || !data.version_no) return null;
  return { promotionId: data.promotion_id, versionNo: data.version_no };
}

export interface PromotionContext {
  title: string;
  /** The advertisement's own sector (D170); defaults to its product's sector. */
  sector?: string | null;
  orgId: string | null;
  productId: string | null;
  channels: string[];
  communicationType: CommunicationType;
  audience: string[];
  isPaid: boolean | null;
  distribution: (typeof DISTRIBUTIONS)[number] | null;
  creatorLicenseNo: string | null;
  caption: string | null;
  reviewerNotes: string | null;
  campaignId: string | null;
  deadlineAt: string | null;
}

const contextRow = (c: Partial<PromotionContext>) => {
  const row: Tables["promotions"]["Update"] = {};
  if (c.title !== undefined) row.title = c.title.trim().slice(0, 200) || "إعلان جديد";
  if (c.productId !== undefined) row.product_id = c.productId;
  if (c.sector !== undefined) row.sector = c.sector;
  if (c.channels !== undefined) row.channels = c.channels;
  if (c.communicationType !== undefined) row.communication_type = c.communicationType;
  if (c.audience !== undefined) row.audience = c.audience.length ? c.audience : ["general"];
  if (c.isPaid !== undefined) row.is_paid = c.isPaid;
  if (c.distribution !== undefined) row.distribution = c.distribution;
  if (c.creatorLicenseNo !== undefined)
    row.creator_license_no =
      c.distribution === "influencer" ? c.creatorLicenseNo?.trim() || null : null;
  if (c.caption !== undefined) row.caption = c.caption?.trim() || null;
  if (c.reviewerNotes !== undefined) row.reviewer_notes = c.reviewerNotes?.trim() || null;
  if (c.campaignId !== undefined) row.campaign_id = c.campaignId;
  if (c.deadlineAt !== undefined) row.deadline_at = c.deadlineAt;
  return row;
};

/** Creates the promotion container (draft). Its first version is uploaded with `createSubmission`. */
export async function createPromotion(userId: string, c: PromotionContext): Promise<string> {
  const id = crypto.randomUUID();
  check(
    await supabase.from("promotions").insert({
      id,
      owner_id: userId,
      org_id: c.orgId,
      ...contextRow(c),
      title: contextRow(c).title ?? "إعلان جديد",
    }),
  );
  return id;
}

/** Removes a promotion that never received a version (e.g. the first upload failed). */
export async function deleteEmptyPromotion(id: string): Promise<void> {
  await supabase.from("promotions").delete().eq("id", id);
}

export async function updatePromotionContext(id: string, patch: Partial<PromotionContext>) {
  check(await supabase.from("promotions").update(contextRow(patch)).eq("id", id));
}

// ---------------------------------------------------------------- products

export interface ProductInput {
  id?: string;
  orgId: string;
  nameAr: string;
  nameEn: string | null;
  aliases: string[];
  sector: (typeof SECTORS)[number];
  productType: (typeof PRODUCT_TYPES)[number];
  regulator: (typeof REGULATORS)[number];
  keyFacts: ProductKeyFacts;
  /** When editing an approved product, the new row supersedes it. */
  supersedes?: Product | null;
}

export async function listProducts(orgId: string): Promise<Product[]> {
  return check(
    await supabase
      .from("products")
      .select("*")
      .eq("org_id", orgId)
      .order("status")
      .order("name_ar"),
  ) as Product[];
}

export async function saveProduct(p: ProductInput): Promise<string> {
  const row = {
    name_ar: p.nameAr.trim(),
    name_en: p.nameEn?.trim() || null,
    aliases: p.aliases.map((a) => a.trim()).filter(Boolean),
    sector: p.sector,
    product_type: p.productType,
    regulator: p.regulator,
    key_facts:
      p.keyFacts as unknown as Database["public"]["Tables"]["products"]["Row"]["key_facts"],
  };
  if (p.id && !p.supersedes) {
    check(await supabase.from("products").update(row).eq("id", p.id));
    return p.id;
  }
  const id = crypto.randomUUID();
  check(
    await supabase.from("products").insert({
      id,
      org_id: p.orgId,
      ...row,
      version: p.supersedes ? p.supersedes.version + 1 : 1,
      supersedes_id: p.supersedes?.id ?? null,
    }),
  );
  return id;
}

export const approveProduct = async (id: string) =>
  void check(await supabase.rpc("approve_product", { _id: id }));
export const archiveProduct = async (id: string) =>
  void check(await supabase.rpc("archive_product", { _id: id }));

// ---------------------------------------------------------------- org settings

export async function fetchOrgSettings(orgId: string): Promise<OrgSettings | null> {
  return check(
    await supabase.from("org_settings").select("*").eq("org_id", orgId).maybeSingle(),
  ) as OrgSettings | null;
}

export async function updateOrgSettings(
  orgId: string,
  patch: Pick<Tables["org_settings"]["Update"], "sector" | "brand_aliases">,
) {
  check(await supabase.from("org_settings").update(patch).eq("org_id", orgId));
}

// ---------------------------------------------------------------- hooks

export const pk = {
  promotion: (id: string) => ["promotion", id] as const,
  promotions: (f: PromotionFilters) => ["promotions", f] as const,
  products: (orgId: string) => ["products", orgId] as const,
  orgSettings: (orgId: string) => ["org-settings", orgId] as const,
};

export const usePromotion = (id: string, enabled = true) =>
  useQuery({ queryKey: pk.promotion(id), queryFn: () => getPromotion(id), enabled });
export const usePromotions = (f: PromotionFilters) =>
  useQuery({ queryKey: pk.promotions(f), queryFn: () => listPromotions(f) });
export const useProducts = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: pk.products(orgId ?? ""),
    queryFn: () => listProducts(orgId!),
    enabled: Boolean(orgId),
  });
export const useOrgSettings = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: pk.orgSettings(orgId ?? ""),
    queryFn: () => fetchOrgSettings(orgId!),
    enabled: Boolean(orgId),
  });
