// v2 Phase 6: feature flags and multi-level approval (presets, live steps, step decisions, carry-forward).
import { useQuery } from "@tanstack/react-query";
import type { Database, Json } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";
import { notifyReview } from "./review";

type Tables = Database["public"]["Tables"];
export type ApprovalPreset = Tables["approval_presets"]["Row"] & {
  approval_preset_steps: PresetStep[];
};
export type PresetStep = Tables["approval_preset_steps"]["Row"];
export type AutoApply = Tables["preset_auto_apply"]["Row"];
export type ReviewStep = Tables["promotion_review_steps"]["Row"];

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
  return res.data as NonNullable<T>;
}

/** Phase 6/7 flags in org_settings.features that have a working feature. Every flag is off unless it is exactly `true`. */
export const FEATURE_FLAGS = [
  "multi_level_approval",
  "risk_acceptance",
  "partners",
  "upload_types",
  "lifecycle",
  "analytics",
  "internal_rules",
  "self_approval",
  "api",
  "notifications_chat",
  "ask_saleem",
  "readability_hint",
  "saleem_fix",
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const flagOn = (features: Json | null | undefined, flag: string) =>
  Boolean(
    features && typeof features === "object" && !Array.isArray(features) && features[flag] === true,
  );

export async function setFeatures(orgId: string, features: Record<string, boolean>) {
  check(
    await supabase
      .from("org_settings")
      .update({ features })
      .eq("org_id", orgId)
      .select("org_id")
      .single(),
  );
}

export const fk = {
  presets: (org: string | null) => ["approval-presets", org] as const,
  autoApply: (org: string | null) => ["preset-auto-apply", org] as const,
  steps: (pid: string) => ["review-steps", pid] as const,
  preview: (pid: string) => ["preset-preview", pid] as const,
  stepCheck: (step: string) => ["can-act-on-step", step] as const,
};

export async function fetchPresets(org: string): Promise<ApprovalPreset[]> {
  return check(
    await supabase
      .from("approval_presets")
      .select("*, approval_preset_steps(*)")
      .eq("org_id", org)
      .eq("active", true)
      .order("created_at"),
  ) as unknown as ApprovalPreset[];
}
export const usePresets = (org: string | null) =>
  useQuery({ queryKey: fk.presets(org), queryFn: () => fetchPresets(org!), enabled: Boolean(org) });

export const useAutoApply = (org: string | null) =>
  useQuery({
    queryKey: fk.autoApply(org),
    enabled: Boolean(org),
    queryFn: async () =>
      check(await supabase.from("preset_auto_apply").select("*").eq("org_id", org!)) as AutoApply[],
  });

export interface StepInput {
  role: string | null;
  user_ids: string[];
  label_ar: string;
}
export async function savePreset(i: {
  org: string;
  id: string | null;
  name: string;
  mode: string;
  isDefault: boolean;
  steps: StepInput[];
}) {
  return check(
    await supabase.rpc("save_approval_preset", {
      _org: i.org,
      _id: i.id,
      _name: i.name,
      _mode: i.mode,
      _is_default: i.isDefault,
      _steps: i.steps.map((s) => ({
        role: s.role,
        user_ids: s.user_ids,
        label_ar: s.label_ar,
      })) as unknown as Json,
    }),
  );
}
export const archivePreset = async (id: string) => {
  check(await supabase.rpc("archive_approval_preset", { _id: id }));
};
export const setAutoApply = async (
  org: string,
  market: string,
  productType: string | null,
  preset: string | null,
) => {
  check(
    await supabase.rpc("set_preset_auto_apply", {
      _org: org,
      _market: market,
      _product_type: productType,
      _preset: preset,
    }),
  );
};

/** Steps of the current flow (latest flow number) for a promotion. */
export async function fetchSteps(pid: string): Promise<ReviewStep[]> {
  const rows = check(
    await supabase
      .from("promotion_review_steps")
      .select("*")
      .eq("promotion_id", pid)
      .order("flow_no")
      .order("step_no"),
  ) as ReviewStep[];
  const last = Math.max(0, ...rows.map((r) => r.flow_no));
  return rows.filter((r) => r.flow_no === last);
}
export const useSteps = (pid: string) =>
  useQuery({ queryKey: fk.steps(pid), queryFn: () => fetchSteps(pid) });
export const flowLive = (steps: ReviewStep[]) =>
  steps.some((s) => s.status === "open" || s.status === "waiting");

export interface PresetPreview {
  enabled: boolean;
  preset_id?: string | null;
  name?: string | null;
  mode?: string | null;
  locked?: boolean;
  carryable?: number[];
}
export const fetchPreview = async (pid: string) =>
  check(await supabase.rpc("preset_preview", { _pid: pid })) as unknown as PresetPreview;

export const usePreview = (pid: string) =>
  useQuery({ queryKey: fk.preview(pid), queryFn: () => fetchPreview(pid) });

export const canActOnStep = async (step: string) => {
  const j = (check(await supabase.rpc("can_act_on_step", { _step: step })) ?? {}) as {
    ok?: boolean;
    reasons?: string[];
  };
  return { ok: Boolean(j.ok), reasons: j.reasons ?? [] };
};

export async function submitWithCarry(
  pid: string,
  note: string,
  ackFailed: boolean,
  carry: number[],
) {
  check(
    await supabase.rpc("submit_promotion_carry", {
      _pid: pid,
      _note: note || null,
      _ack_failed: ackFailed,
      _carry: carry,
    }),
  );
  notifyReview(pid);
}

export async function decideStep(
  pid: string,
  step: string,
  i: {
    decision: "approve" | "request_changes" | "reject";
    reasonIds: string[];
    reasonOther: string;
    comment: string;
    freshReview: boolean;
  },
) {
  const id = check(
    await supabase.rpc("decide_promotion_step", {
      _pid: pid,
      _step: step,
      _decision: i.decision,
      _reason_ids: i.reasonIds,
      _reason_other: i.reasonOther.trim() || null,
      _comment: i.comment.trim() || null,
      _fresh_review: i.freshReview,
    }),
  );
  notifyReview(pid);
  return id;
}

export async function replaceFlow(pid: string, preset: string) {
  check(await supabase.rpc("replace_review_flow", { _pid: pid, _preset: preset }));
  notifyReview(pid);
}

// ---------------------------------------------------------------- 6.2 risk acceptance (never an approval)
export const setRiskAcceptor = async (org: string, user: string, on: boolean) => {
  check(await supabase.rpc("set_risk_acceptor", { _org: org, _user: user, _on: on }));
};
export async function requestRisk(pid: string, acceptor: string, reason: string) {
  check(
    await supabase.rpc("request_risk_acceptance", {
      _pid: pid,
      _acceptor: acceptor,
      _reason: reason,
    }),
  );
  notifyReview(pid);
}
export async function decideRisk(pid: string, accept: boolean, reason: string) {
  check(await supabase.rpc("decide_risk", { _pid: pid, _accept: accept, _reason: reason }));
  notifyReview(pid);
}

// ---------------------------------------------------------------- 6.4 variations
export async function fetchVariations(group: string) {
  return check(
    await supabase
      .from("promotions")
      .select("id, title, review_status, updated_at")
      .eq("variation_group_id", group)
      .order("created_at"),
  );
}
export const createVariation = async (pid: string, title: string) =>
  check(await supabase.rpc("create_variation", { _pid: pid, _title: title }));
export async function submitVariations(group: string) {
  const r = check(await supabase.rpc("submit_variations", { _group: group })) as unknown as {
    submitted: string[];
    skipped: { id: string; reason: string }[];
  };
  for (const id of r.submitted) notifyReview(id);
  return r;
}

// ---------------------------------------------------------------- 6.5 lifecycle
export async function setEvergreen(pid: string, evergreen: boolean, nextReview: string | null) {
  check(
    await supabase.rpc("set_evergreen", {
      _pid: pid,
      _evergreen: evergreen,
      _next_review: nextReview,
    }),
  );
}
export async function recordLifecycle(
  pid: string,
  event: "published" | "taken_down",
  at: string | null,
) {
  check(await supabase.rpc("record_lifecycle", { _pid: pid, _event: event, _at: at }));
}
export async function requestWithdrawal(pid: string, noticeAt: string, reason: string) {
  const due = check(
    await supabase.rpc("request_withdrawal", { _pid: pid, _notice_at: noticeAt, _reason: reason }),
  );
  notifyReview(pid);
  return due;
}
export async function markWithdrawn(pid: string, reason: string) {
  check(await supabase.rpc("mark_withdrawn", { _pid: pid, _reason: reason }));
}
export async function completeRereview(
  pid: string,
  stillValid: boolean,
  nextReview: string | null,
  comment: string,
) {
  check(
    await supabase.rpc("complete_rereview", {
      _pid: pid,
      _still_valid: stillValid,
      _next_review: nextReview,
      _comment: comment.trim() || null,
    }),
  );
  notifyReview(pid);
}
/** `datetime-local` value (Riyadh wall time as typed) → ISO with the +03:00 offset. */
export const riyadhIso = (local: string) =>
  local ? `${local.length === 16 ? `${local}:00` : local}+03:00` : "";

// ---------------------------------------------------------------- 6.6 analytics
export interface Stat {
  mean: number | null;
  median: number | null;
  n: number;
}
export interface OrgMetrics {
  range: { from: string; to: string; sla_business_days: number };
  promotions_submitted: number;
  versions_submitted: number;
  avg_versions: number;
  early_requests: number;
  sla_compliance: number;
  reviews_decided: number;
  first_time_approval: number;
  approval_time_hours: Stat;
  first_response_hours: Stat;
  iterations: Stat;
  reasons: { id: string; label_ar: string; label_en: string; count: number }[];
  reasons_other: number;
  workload: { user_id: string; name: string | null; decisions: number; open: number }[];
  volume: Record<"by_status" | "by_channel" | "by_type" | "by_product", Record<string, number>>;
  risk_accepted: number;
}
export interface MetricFilters {
  product_id?: string;
  channel?: string;
  communication_type?: string;
}
export async function fetchMetrics(org: string, from: string, to: string, filters: MetricFilters) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return check(
    await supabase.rpc("org_metrics", { _org: org, _from: from, _to: to, _filters: clean as Json }),
  ) as unknown as OrgMetrics;
}
/** "0.6667" → "67%". */
export const pct = (x: number) => `${Math.round((x || 0) * 100)}%`;

// ---------------------------------------------------------------- 7.1 self-approval
export type SelfApprovalRule = Database["public"]["Tables"]["self_approval_rules"]["Row"];
export const canSelfApprove = async (pid: string) => {
  const j = (check(await supabase.rpc("can_self_approve", { _pid: pid })) ?? {}) as {
    ok?: boolean;
    reasons?: string[];
  };
  return { ok: Boolean(j.ok), reasons: j.reasons ?? [] };
};
export async function selfApprove(pid: string, comment: string) {
  check(await supabase.rpc("self_approve", { _pid: pid, _comment: comment.trim() || null }));
  notifyReview(pid);
}
export const useSelfApprovalRules = (org: string) =>
  useQuery({
    queryKey: ["self-approval-rules", org],
    queryFn: async () =>
      check(
        await supabase
          .from("self_approval_rules")
          .select("*")
          .eq("org_id", org)
          .order("created_at"),
      ) as SelfApprovalRule[],
  });
export const saveSelfApprovalRule = async (
  org: string,
  i: { name: string; channels: string[]; markets: string[]; roles: string[]; ai: string },
) =>
  check(
    await supabase.rpc("save_self_approval_rule", {
      _org: org,
      _id: null,
      _name: i.name,
      _channels: i.channels,
      _product_types: [],
      _markets: i.markets,
      _roles: i.roles as SelfApprovalRule["roles"],
      _users: [],
      _ai: i.ai,
      _active: true,
    }),
  );
