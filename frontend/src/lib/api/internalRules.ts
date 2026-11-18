// v2 Phase 6.7: brand guidelines and internal-policy rules (drafted, edited and approved by people).
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";

type Tables = Database["public"]["Tables"];
export type InternalRule = Tables["internal_rules"]["Row"];
export type BrandGuideline = Tables["brand_guidelines"]["Row"];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new ApiError(res.error.message);
  return res.data as NonNullable<T>;
}

export const ik = {
  rules: (org: string) => ["internal-rules", org] as const,
  guidelines: (org: string) => ["brand-guidelines", org] as const,
};

export const useInternalRules = (org: string) =>
  useQuery({
    queryKey: ik.rules(org),
    queryFn: async () =>
      check(
        await supabase
          .from("internal_rules")
          .select("*")
          .eq("org_id", org)
          .neq("status", "archived")
          .order("code"),
      ) as InternalRule[],
  });
export const useGuidelines = (org: string) =>
  useQuery({
    queryKey: ik.guidelines(org),
    queryFn: async () =>
      check(
        await supabase
          .from("brand_guidelines")
          .select("*")
          .eq("org_id", org)
          .order("created_at", { ascending: false }),
      ) as BrandGuideline[],
  });

export const saveGuideline = async (org: string, title: string, text: string) =>
  check(await supabase.rpc("save_brand_guideline", { _org: org, _title: title, _text: text }));

/** Drafts rules from a guideline (model when configured, otherwise directive sentences). Drafts never run until approved. */
export async function draftRules(org: string, guideline: string) {
  const { data, error } = await supabase.functions.invoke("internal-rules-draft", {
    body: { org_id: org, guideline_id: guideline },
  });
  if (error) throw new ApiError(error.message);
  return data as { drafted: number; source: "model_draft" | "heuristic_draft" };
}

export const saveInternalRule = async (
  org: string,
  i: { id: string | null; code: string; title: string; instruction: string; severity: string },
) =>
  check(
    await supabase.rpc("save_internal_rule", {
      _org: org,
      _id: i.id,
      _code: i.code,
      _title: i.title,
      _instruction: i.instruction,
      _severity: i.severity,
    }),
  );
export const approveInternalRule = async (id: string) => {
  check(await supabase.rpc("approve_internal_rule", { _id: id }));
};
export const archiveInternalRule = async (id: string) => {
  check(await supabase.rpc("archive_internal_rule", { _id: id }));
};
