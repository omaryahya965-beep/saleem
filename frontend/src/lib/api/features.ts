// Data access for Phase 5 features: usage/plans, archive batches, organizations, sharing,
// rulebook admin, verification, notifications, account. All calls go through RLS or
// SECURITY DEFINER RPCs that check the caller.
import type { Database } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError, sha256Hex, type Submission } from "./data";

type Tables = Database["public"]["Tables"];
export type Organization = Tables["organizations"]["Row"];
export type OrgMember = Tables["org_members"]["Row"];
export type OrgInvite = Tables["org_invites"]["Row"];
export type Campaign = Tables["campaigns"]["Row"];
export type Batch = Tables["batches"]["Row"];
export type ShareLink = Tables["share_links"]["Row"];
export type ShareReview = Tables["share_reviews"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type RulebookVersion = Tables["rulebook_versions"]["Row"];
export type Rule = Tables["rules"]["Row"];
export type OrgRole = Database["public"]["Enums"]["org_role"];

/** Maps Postgres/RPC errors raised by our functions to stable codes for i18n. */
export function errorCode(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  const known = [
    "quota_exceeded",
    "clip_too_long",
    "batch_full",
    "plan_no_orgs",
    "invite_invalid",
    "invite_email_mismatch",
    "last_owner",
    "link_invalid",
    "rate_limited",
    "campaign_mismatch",
    "transfer_ownership_first",
    "confirmation_mismatch",
  ];
  return (
    known.find((k) => msg.includes(k)) ??
    ((e as { code?: string })?.code === "42501" ? "forbidden" : "generic")
  );
}

function check<T>(res: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (res.error) throw Object.assign(new ApiError(res.error.message), { code: res.error.code });
  return res.data as NonNullable<T>;
}

// ---------------------------------------------------------------- usage
export interface Usage {
  plan: string;
  plan_name_ar: string;
  plan_name_en: string;
  monthly_checks: number;
  max_batch: number;
  orgs_allowed: boolean;
  used: number;
  period_start: string;
  period_end: string;
}
export async function fetchUsage(): Promise<Usage | null> {
  return check(await supabase.rpc("my_usage")) as unknown as Usage | null;
}

// ---------------------------------------------------------------- archive batches
export async function createBatch(name: string): Promise<Batch> {
  return check(await supabase.from("batches").insert({ name }).select().single());
}
export async function fetchBatches(): Promise<
  (Batch & { submissions: Pick<Submission, "id" | "status" | "overall_status">[] })[]
> {
  return check(
    await supabase
      .from("batches")
      .select("*, submissions(id, status, overall_status)")
      .order("created_at", { ascending: false }),
  ) as never;
}
export async function fetchBatch(id: string): Promise<{
  batch: Batch;
  items: (Submission & {
    findings: { rule_code: string; severity: string; run_id: string }[];
    analysis_runs: { id: string; started_at: string }[];
  })[];
}> {
  const batch = check(await supabase.from("batches").select("*").eq("id", id).single());
  const items = check(
    await supabase
      .from("submissions")
      .select("*, findings(rule_code, severity, run_id), analysis_runs(id, started_at)")
      .eq("batch_id", id)
      .order("created_at"),
  );
  return { batch, items: items as never };
}

// ---------------------------------------------------------------- organizations
export async function fetchMyOrgs(): Promise<(Organization & { org_members: OrgMember[] })[]> {
  return check(
    await supabase.from("organizations").select("*, org_members(*)").order("created_at"),
  ) as never;
}
export async function fetchOrg(id: string) {
  const [org, members, invites, campaigns, subs] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", id).single(),
    supabase.from("org_members").select("*").eq("org_id", id).order("created_at"),
    supabase
      .from("org_invites")
      .select("*")
      .eq("org_id", id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaigns")
      .select("*")
      .eq("org_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("submissions")
      .select("id, title, platform, status, overall_status, created_at, user_id, campaign_id")
      .eq("org_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  return {
    org: check(org),
    members: check(members),
    invites: invites.error ? [] : (invites.data ?? []),
    campaigns: check(campaigns),
    submissions: check(subs),
  };
}
export const createOrg = async (name: string) =>
  check(await supabase.rpc("create_organization", { _name: name })) as string;
export const createInvite = async (org: string, email: string, role: OrgRole) =>
  check(
    await supabase.rpc("create_org_invite", { _org: org, _email: email, _role: role }),
  ) as string;
export const acceptInvite = async (token: string) =>
  check(await supabase.rpc("accept_org_invite", { _token: token })) as string;
export const revokeInvite = async (id: string) =>
  void check(await supabase.rpc("revoke_org_invite", { _invite: id }));
export const setMemberRole = async (org: string, user: string, role: OrgRole) =>
  void check(await supabase.rpc("set_org_member_role", { _org: org, _user: user, _role: role }));
export const removeMember = async (org: string, user: string) =>
  void check(await supabase.rpc("remove_org_member", { _org: org, _user: user }));
export async function createCampaign(c: {
  org_id: string;
  name: string;
  brand: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_by: string;
}) {
  return check(await supabase.from("campaigns").insert(c).select().single());
}

// ---------------------------------------------------------------- sharing
export const createShareLink = async (sid: string, days: number) =>
  check(await supabase.rpc("create_share_link", { _sid: sid, _days: days })) as string;
export const revokeShareLink = async (id: string) =>
  void check(await supabase.rpc("revoke_share_link", { _id: id }));
export async function fetchShares(
  sid: string,
): Promise<{ links: ShareLink[]; reviews: ShareReview[] }> {
  const [l, r] = await Promise.all([
    supabase
      .from("share_links")
      .select("*")
      .eq("submission_id", sid)
      .order("created_at", { ascending: false }),
    supabase
      .from("share_reviews")
      .select("*")
      .eq("submission_id", sid)
      .order("created_at", { ascending: false }),
  ]);
  return { links: check(l), reviews: check(r) };
}
export interface SharedReport {
  valid: boolean;
  expires_at?: string;
  submission?: {
    id: string;
    title: string | null;
    kind: string;
    platform: string;
    caption: string;
    overall_status: string | null;
    analyzed_at: string | null;
    duration_seconds: number | null;
  };
  rulebook_version?: string | null;
  findings?: {
    id: string;
    rule_code: string;
    severity: "violation" | "warning";
    t_start: number | null;
    evidence_type: string;
    evidence_text: string | null;
    explanation_ar: string | null;
    explanation_en: string | null;
    fix_ar: string | null;
    fix_en: string | null;
  }[];
  rules?: {
    code: string;
    title_ar: string;
    title_en: string;
    source_name: string;
    source_name_en: string | null;
    source_url: string;
  }[];
  reviews?: {
    decision: string;
    comment: string | null;
    reviewer_name: string;
    created_at: string;
  }[];
}
export const fetchSharedReport = async (token: string) =>
  check(await supabase.rpc("get_shared_report", { _token: token })) as unknown as SharedReport;
export const submitShareReview = async (
  token: string,
  decision: "approved" | "changes_requested" | "comment",
  comment: string,
  name: string,
) =>
  void check(
    await supabase.rpc("submit_share_review", {
      _token: token,
      _decision: decision,
      _comment: comment,
      _name: name,
    }),
  );

// ---------------------------------------------------------------- verification
export interface Verification {
  found: boolean;
  status?: string;
  overall_status?: string | null;
  analyzed_at?: string | null;
  platform?: string;
  kind?: string;
  is_demo?: boolean;
  content_hash?: string;
  report_hash?: string | null;
  sealed_at?: string;
  unchanged?: boolean;
  rulebook_version?: string | null;
  violations?: number;
  warnings?: number;
}
export const verifyLog = async (id: string) =>
  check(await supabase.rpc("verify_compliance_log", { _sid: id })) as unknown as Verification;
export { sha256Hex };

// ---------------------------------------------------------------- rulebook admin
export async function fetchAllVersions(): Promise<(RulebookVersion & { rules: Rule[] })[]> {
  return check(
    await supabase
      .from("rulebook_versions")
      .select("*, rules(*)")
      .order("created_at", { ascending: false }),
  ) as never;
}
export const createDraft = async (label: string, notes: string) =>
  check(await supabase.rpc("create_rulebook_draft", { _label: label, _notes: notes })) as string;
export const setVersionStatus = async (
  id: string,
  status: "draft" | "legal_review" | "published",
) => void check(await supabase.rpc("set_rulebook_status", { _version: id, _status: status }));
export async function updateVersion(
  id: string,
  patch: Pick<RulebookVersion, "changelog" | "effective_from" | "notes">,
) {
  check(await supabase.from("rulebook_versions").update(patch).eq("id", id));
}
export async function updateRule(id: string, patch: Partial<Rule>) {
  check(await supabase.from("rules").update(patch).eq("id", id));
}
export const rerunSubmission = async (sid: string) => {
  check(await supabase.rpc("rerun_submission", { _sid: sid }));
  await supabase.functions.invoke("analyze", { body: { submission_id: sid } });
};

// ---------------------------------------------------------------- notifications
export async function fetchNotifications(): Promise<Notification[]> {
  return check(
    await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
  );
}
export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  check(
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids),
  );
}

// ---------------------------------------------------------------- account
export async function updateNotifyPrefs(
  userId: string,
  patch: { notify_email?: boolean; preferred_lang?: "ar" | "en" },
) {
  check(await supabase.from("profiles").update(patch).eq("id", userId));
}
export async function deleteAccount(confirmEmail: string) {
  const { data, error } = await supabase.functions.invoke("account", {
    body: { action: "delete", confirm: confirmEmail },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new ApiError(body?.error ?? error.message);
  }
  return data;
}

/** Everything the user can read about themselves, as one JSON document (PDPL data portability). */
export async function exportMyData(userId: string) {
  const [profile, subs, notifications, batches, memberships] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("submissions")
      .select(
        "*, transcripts(*), analysis_runs(id, started_at, finished_at, llm_model, asr_model, prompt_version, rulebook_version, cost_usd), findings(*), compliance_logs(*), share_links(id, created_at, expires_at, revoked_at), share_reviews(*)",
      )
      .eq("user_id", userId),
    supabase.from("notifications").select("*").eq("user_id", userId),
    supabase.from("batches").select("*").eq("user_id", userId),
    supabase.from("org_members").select("*, organizations(name)").eq("user_id", userId),
  ]);
  return {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    submissions: subs.data ?? [],
    notifications: notifications.data ?? [],
    archive_batches: batches.data ?? [],
    organizations: memberships.data ?? [],
    note: "Media files are deleted 24 h after each check and are not included.",
  };
}

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
