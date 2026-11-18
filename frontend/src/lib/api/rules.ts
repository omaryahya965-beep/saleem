// v2 rulebook data: packs, sources, per-org pack settings, rule review state (platform admin).
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";

type Tables = Database["public"]["Tables"];
export type RulePack = Tables["rule_packs"]["Row"];
export type OrgRulePack = Tables["org_rule_packs"]["Row"];
export type Source = Tables["regulatory_sources"]["Row"];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
  return res.data as NonNullable<T>;
}

export const fetchPacks = async () =>
  check(await supabase.from("rule_packs").select("*").order("code")) as RulePack[];
export const fetchSources = async () =>
  check(await supabase.from("regulatory_sources").select("*")) as Source[];
export const fetchOrgPacks = async (orgId: string) =>
  check(await supabase.from("org_rule_packs").select("*").eq("org_id", orgId)) as OrgRulePack[];

export const setOrgRulePack = async (
  org: string,
  pack: string,
  enabled: boolean,
  includeDrafts: boolean,
) =>
  void check(
    await supabase.rpc("set_org_rule_pack", {
      _org: org,
      _pack: pack,
      _enabled: enabled,
      _include_drafts: includeDrafts,
    }),
  );

export const setRuleReviewState = async (p: {
  rule: string;
  state: string;
  reason: string;
  officialText?: string | null;
  reviewer?: string | null;
}) =>
  void check(
    await supabase.rpc("set_rule_review_state", {
      _rule: p.rule,
      _state: p.state,
      _reason: p.reason,
      _official_text_ar: p.officialText ?? null,
      _reviewer: p.reviewer ?? null,
    }),
  );

export const usePacks = () =>
  useQuery({ queryKey: ["rule-packs"], queryFn: fetchPacks, staleTime: 10 * 60_000 });
export const useSources = () =>
  useQuery({ queryKey: ["sources"], queryFn: fetchSources, staleTime: 10 * 60_000 });
export const useOrgPacks = (orgId: string) =>
  useQuery({
    queryKey: ["org-rule-packs", orgId],
    queryFn: () => fetchOrgPacks(orgId),
    enabled: Boolean(orgId),
  });

/** Whether a pack is on for an org: its row, else the default (enabled_by_default and sector match). */
export function packEnabled(
  pack: RulePack,
  row: OrgRulePack | undefined,
  sector: string | null,
): boolean {
  if (pack.always_enabled) return true;
  if (row) return row.enabled;
  return (
    pack.enabled_by_default &&
    (pack.default_sectors.length === 0 ||
      (sector !== null && pack.default_sectors.includes(sector)))
  );
}
