// v2 Phase 6.7: brand guidelines and internal-policy rules (drafted, edited and approved by people).
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";

type Tables = Database["public"]["Tables"];
export type InternalRule = Tables["internal_rules"]["Row"];
/** D200: what an internal rule governs. Descriptive only — never a Saudi regulatory requirement. */
export const RULE_CATEGORIES = [
  "compliance_policy",
  "approved_language",
  "prohibited_claim",
  "brand_guideline",
  "logo",
  "brand_colors",
  "required_disclosure",
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];
export type BrandGuideline = Tables["brand_guidelines"]["Row"];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
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

const untypedRpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export const saveInternalRule = async (
  org: string,
  i: {
    id: string | null;
    code: string;
    title: string;
    instruction: string;
    severity: string;
    category: RuleCategory;
  },
) =>
  check(
    await untypedRpc("save_internal_rule_v2", {
      _org: org,
      _id: i.id,
      _code: i.code,
      _title: i.title,
      _instruction: i.instruction,
      _severity: i.severity,
      _category: i.category,
    }),
  );
export const approveInternalRule = async (id: string) => {
  check(await supabase.rpc("approve_internal_rule", { _id: id }));
};
export const archiveInternalRule = async (id: string) => {
  check(await supabase.rpc("archive_internal_rule", { _id: id }));
};

// --- Phase 8.6: versions and «جرّب القاعدة».
export type InternalRuleVersion = Tables["internal_rule_versions"]["Row"];
export const useRuleVersions = (org: string) =>
  useQuery({
    queryKey: ["internal-rule-versions", org],
    enabled: Boolean(org),
    queryFn: async () =>
      check(
        await supabase
          .from("internal_rule_versions")
          .select("*")
          .eq("org_id", org)
          .order("version", { ascending: false }),
      ) as InternalRuleVersion[],
  });

/** Analysed versions in the organisation a rule can be tried on (latest first). */
export const useTryTargets = (org: string) =>
  useQuery({
    queryKey: ["try-targets", org],
    enabled: Boolean(org),
    queryFn: async () => {
      const promos = check(
        await supabase
          .from("promotions")
          .select("id, title, current_version_id")
          .eq("org_id", org)
          .not("current_version_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(30),
      );
      const ids = promos.map((p) => p.current_version_id!).filter(Boolean);
      if (!ids.length) return [];
      const subs = check(
        await supabase
          .from("submissions")
          .select("id, version_no, status, kind")
          .in("id", ids)
          .eq("status", "done"),
      );
      return subs.map((s) => ({
        submissionId: s.id,
        versionNo: s.version_no,
        kind: s.kind,
        promotionId: promos.find((p) => p.current_version_id === s.id)!.id,
        title: promos.find((p) => p.current_version_id === s.id)!.title,
      }));
    },
  });

export interface TryFinding {
  rule_code: string;
  severity: string;
  finding_type: string;
  explanation_ar: string;
  suggested_fix_ar: string | null;
  evidence: { modality: string; quote: string; t_start: number | null; t_end: number | null };
}
export type TryResult =
  | { status: "done"; result: { outcome: string; reason: string } | null; findings: TryFinding[] }
  | { status: "unavailable" | "unable_to_verify" | "failed"; error?: string };

/** Runs one company rule on an analysed version without saving anything (the analyze function, text only). */
export async function tryRule(ruleId: string, submissionId: string): Promise<TryResult> {
  const { data, error } = await supabase.functions.invoke("analyze", {
    body: { try_rule: { rule_id: ruleId, submission_id: submissionId } },
  });
  if (error) throw new ApiError(error.message);
  return data as TryResult;
}
