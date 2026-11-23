// v2 Phase 5: claims and disclaimers libraries, promotion links, saved views, rule overrides.
import { useQuery } from "@tanstack/react-query";
import type { Database, Json } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";

type Tables = Database["public"]["Tables"];
export type Claim = Tables["claims"]["Row"];
export type Disclaimer = Tables["disclaimers"]["Row"];
export type SavedView = Tables["saved_views"]["Row"];
export type RuleOverrideRow = Tables["org_rule_overrides"]["Row"];
export type Substantiation =
  { kind: "url"; url: string; title?: string } | { kind: "file"; path: string; name: string };

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
  return res.data as NonNullable<T>;
}

export const fetchClaims = async (orgId: string) =>
  check(
    await supabase
      .from("claims")
      .select("*")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
  ) as Claim[];

export interface ClaimInput {
  id: string | null;
  orgId: string;
  name: string;
  textAr: string;
  textEn: string;
  productIds: string[];
  channels: string[];
  communicationTypes: string[];
  substantiation: Substantiation[];
  nextReview: string | null;
  expires: string | null;
}
export const saveClaim = async (c: ClaimInput) =>
  check(
    await supabase.rpc("save_claim", {
      _id: c.id,
      _org: c.orgId,
      _name: c.name,
      _text_ar: c.textAr,
      _text_en: c.textEn || null,
      _product_ids: c.productIds,
      _channels: c.channels,
      _communication_types: c.communicationTypes,
      _substantiation: c.substantiation as unknown as Json,
      _next_review: c.nextReview,
      _expires: c.expires,
    }),
  ) as string;
export const submitClaim = async (id: string) =>
  void check(await supabase.rpc("submit_claim", { _id: id }));
export const reviewClaim = async (
  id: string,
  decision: "approve" | "reject" | "request_changes",
  comment: string,
) =>
  void check(
    await supabase.rpc("review_claim", { _id: id, _decision: decision, _comment: comment || null }),
  );
export const newClaimVersion = async (id: string) =>
  check(await supabase.rpc("new_claim_version", { _id: id })) as string;
export const archiveClaim = async (id: string) =>
  void check(await supabase.rpc("archive_claim", { _id: id }));
export const linkClaim = async (pid: string, claim: string, link: boolean) =>
  void check(await supabase.rpc("link_claim", { _pid: pid, _claim: claim, _link: link }));
export const claimFromFinding = async (
  finding: string,
  name: string,
  text: string,
  substantiation: Substantiation[],
  approve: boolean,
) =>
  check(
    await supabase.rpc("claim_add_from_finding", {
      _finding: finding,
      _name: name,
      _text_ar: text,
      _substantiation: substantiation as unknown as Json,
      _approve: approve,
    }),
  ) as string;

/** Uploads a substantiation file to the private evidence bucket ({org}/claims/{claimKey}/{file}). */
export async function uploadEvidence(orgId: string, file: File): Promise<Substantiation> {
  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${orgId}/claims/${crypto.randomUUID()}/${safe}`;
  const { error } = await supabase.storage
    .from("evidence")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new ApiError(error.message, "upload");
  return { kind: "file", path, name: file.name };
}
export async function evidenceUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

export const fetchDisclaimers = async (orgId: string) =>
  check(
    await supabase
      .from("disclaimers")
      .select("*")
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .neq("status", "archived")
      .order("created_at"),
  ) as Disclaimer[];
export const saveDisclaimer = async (d: {
  id: string | null;
  orgId: string;
  name: string;
  textAr: string;
  textEn: string;
  productTypes: string[];
  channels: string[];
  communicationTypes: string[];
  requiredBy: string[];
  prominence: boolean;
  status: "draft" | "active" | "archived";
}) =>
  check(
    await supabase.rpc("save_disclaimer", {
      _id: d.id,
      _org: d.orgId,
      _name: d.name,
      _text_ar: d.textAr,
      _text_en: d.textEn || null,
      _product_types: d.productTypes,
      _channels: d.channels,
      _communication_types: d.communicationTypes,
      _required_by: d.requiredBy,
      _prominence: d.prominence,
      _status: d.status,
    }),
  ) as string;

export const fetchLinkedClaims = async (pid: string) =>
  check(
    await supabase.from("promotion_claims").select("claim_id, link_source").eq("promotion_id", pid),
  ) as { claim_id: string; link_source: string }[];

export const fetchSavedViews = async (scope: "promotions" | "queue" | "claims") =>
  check(
    await supabase.from("saved_views").select("*").eq("scope", scope).order("created_at"),
  ) as SavedView[];
export const saveView = async (v: {
  orgId: string | null;
  scope: "promotions" | "queue" | "claims";
  name: string;
  filters: Record<string, unknown>;
  shared: boolean;
}) =>
  void check(
    await supabase.from("saved_views").insert({
      org_id: v.orgId,
      scope: v.scope,
      name: v.name,
      filters: v.filters as Json,
      shared: v.shared,
    }),
  );
export const deleteView = async (id: string) =>
  void check(await supabase.from("saved_views").delete().eq("id", id));

export const fetchOverrides = async (orgId: string) =>
  check(
    await supabase
      .from("org_rule_overrides")
      .select("*")
      .eq("org_id", orgId)
      .is("archived_at", null),
  ) as RuleOverrideRow[];
export const setRuleOverride = async (
  orgId: string,
  ruleCode: string,
  patch: Record<string, unknown>,
  reason: string,
) =>
  check(
    await supabase.rpc("set_rule_override", {
      _org: orgId,
      _rule_code: ruleCode,
      _patch: patch as Json,
      _reason: reason,
    }),
  ) as string;
export const archiveRuleOverride = async (id: string) =>
  void check(await supabase.rpc("archive_rule_override", { _id: id }));

export const lk = {
  claims: (org: string) => ["claims", org] as const,
  disclaimers: (org: string) => ["disclaimers", org] as const,
  linked: (pid: string) => ["linked-claims", pid] as const,
  views: (scope: string) => ["saved-views", scope] as const,
  overrides: (org: string) => ["rule-overrides", org] as const,
};
export const useClaims = (org: string | null | undefined) =>
  useQuery({
    queryKey: lk.claims(org ?? ""),
    queryFn: () => fetchClaims(org!),
    enabled: Boolean(org),
  });
export const useDisclaimers = (org: string | null | undefined) =>
  useQuery({
    queryKey: lk.disclaimers(org ?? ""),
    queryFn: () => fetchDisclaimers(org!),
    enabled: Boolean(org),
  });
export const useOverrides = (org: string | null | undefined) =>
  useQuery({
    queryKey: lk.overrides(org ?? ""),
    queryFn: () => fetchOverrides(org!),
    enabled: Boolean(org),
  });

/** Claims whose next review is within `days` (for the dashboard and reminders). */
export const claimsDue = (claims: Claim[], days = 7, today = new Date()) =>
  claims.filter(
    (c) =>
      c.status === "approved" &&
      c.next_review_at &&
      (new Date(c.next_review_at).getTime() - today.getTime()) / 86_400_000 <= days,
  );
