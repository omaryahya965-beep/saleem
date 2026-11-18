// v2 human review: state-machine RPCs, finding responses, queue, history and audit log.
// Every state change goes through a SECURITY DEFINER RPC; the client never writes review fields.
import { useQuery } from "@tanstack/react-query";
import type { Database, Json } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError } from "./data";
import { dbErrorCode, type Promotion } from "./promotions";

type Tables = Database["public"]["Tables"];
export type ReviewDecision = Tables["review_decisions"]["Row"];
export type ReviewEvent = Tables["review_events"]["Row"];
export type FindingResponse = Tables["finding_responses"]["Row"];
export type RejectionReason = Tables["rejection_reasons"]["Row"];
export type DecisionKind = "approve" | "conditional_approve" | "request_changes" | "reject";
export type ResponseAction =
  "agree_will_action" | "dispute" | "reply" | "agree_please_action" | "not_required" | "dismiss";

export const UPLOADER_ACTIONS: ResponseAction[] = ["agree_will_action", "dispute", "reply"];
export const REVIEWER_ACTIONS: ResponseAction[] = [
  "agree_please_action",
  "not_required",
  "dismiss",
  "reply",
];
export const COMMENT_REQUIRED = new Set<ResponseAction>(["dispute", "not_required", "dismiss"]);

function check<T>(res: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (res.error) throw Object.assign(ApiError.from(res.error), { sqlCode: res.error.code });
  return res.data as NonNullable<T>;
}

/** i18n key under review.preflight for an RPC error or a preflight reason (`missing_uploader_responses:3`). */
export function preflightKey(reasonOrError: unknown): { key: string; n?: number } {
  const raw =
    typeof reasonOrError === "string" ? reasonOrError : (dbErrorCode(reasonOrError) ?? "generic");
  const [key, n] = raw.split(":");
  return { key: key || "generic", n: n ? Number(n) : undefined };
}

export interface Preflight {
  ok: boolean;
  reasons: string[];
}
const asPreflight = (j: Json): Preflight => {
  const o = (j ?? {}) as { ok?: boolean; reasons?: string[] };
  return { ok: Boolean(o.ok), reasons: o.reasons ?? [] };
};

/** Emails the in-app notifications a review action created (fire and forget; failures are logged server-side). */
export function notifyReview(promotionId: string) {
  void supabase.functions
    .invoke("review-notify", { body: { promotion_id: promotionId } })
    .catch(() => {});
}

export const canSubmit = async (pid: string, note?: string, ackFailed = false) =>
  asPreflight(
    check(
      await supabase.rpc("can_submit", { _pid: pid, _note: note ?? null, _ack_failed: ackFailed }),
    ),
  );
export const canDecide = async (pid: string) =>
  asPreflight(check(await supabase.rpc("can_decide", { _pid: pid })));

async function act(
  pid: string,
  call: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
) {
  check(await call);
  notifyReview(pid);
}
export const submitPromotion = (pid: string, note: string, ackFailed: boolean) =>
  act(
    pid,
    supabase.rpc("submit_promotion", { _pid: pid, _note: note || null, _ack_failed: ackFailed }),
  );
export const openReview = (pid: string) => act(pid, supabase.rpc("open_review", { _pid: pid }));
export const assignReviewer = (pid: string, user: string) =>
  act(pid, supabase.rpc("assign_reviewer", { _pid: pid, _user: user }));
export const decidePromotion = (
  pid: string,
  d: {
    decision: DecisionKind;
    reasonIds: string[];
    reasonOther: string;
    condition: string;
    comment: string;
  },
) =>
  act(
    pid,
    supabase.rpc("decide_promotion", {
      _pid: pid,
      _decision: d.decision,
      _reason_ids: d.reasonIds,
      _reason_other: d.reasonOther || null,
      _condition: d.condition || null,
      _comment: d.comment || null,
    }),
  );
export const escalatePromotion = (pid: string, legalUser: string, question: string) =>
  act(
    pid,
    supabase.rpc("escalate_promotion", { _pid: pid, _legal_user: legalUser, _question: question }),
  );
export const respondEscalation = (pid: string, response: string) =>
  act(pid, supabase.rpc("respond_escalation", { _pid: pid, _response: response }));
export const archivePromotion = (pid: string, reason: string) =>
  act(pid, supabase.rpc("archive_promotion", { _pid: pid, _reason: reason }));
export const respondFinding = async (finding: string, action: ResponseAction, comment: string) =>
  check(
    await supabase.rpc("respond_finding", {
      _finding: finding,
      _action: action,
      _comment: comment || null,
    }),
  );
export const verifyChain = async (pid: string) => {
  const j = check(await supabase.rpc("verify_decision_chain", { _pid: pid })) as {
    valid?: boolean;
    broken_at?: string | null;
  };
  return { valid: Boolean(j.valid), brokenAt: j.broken_at ?? null };
};

export async function fetchResponses(submissionId: string): Promise<FindingResponse[]> {
  return check(
    await supabase
      .from("finding_responses")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at"),
  ) as FindingResponse[];
}
export async function fetchReasons(orgId: string | null): Promise<RejectionReason[]> {
  let q = supabase
    .from("rejection_reasons")
    .select("*")
    .eq("kind", "promotion")
    .eq("archived", false)
    .order("sort_order");
  q = orgId ? q.or(`org_id.is.null,org_id.eq.${orgId}`) : q.is("org_id", null);
  return check(await q) as RejectionReason[];
}
export async function fetchMembers(orgId: string) {
  return check(
    await supabase
      .from("org_members")
      .select("user_id, role, display_name, email, can_accept_risk")
      .eq("org_id", orgId),
  ) as {
    user_id: string;
    role: string;
    display_name: string | null;
    email: string | null;
    can_accept_risk: boolean;
  }[];
}

export interface HistoryBundle {
  events: ReviewEvent[];
  decisions: ReviewDecision[];
  shareReviews: {
    id: string;
    decision: string;
    comment: string | null;
    reviewer_name: string | null;
    created_at: string;
  }[];
}
export async function fetchHistory(pid: string, versionIds: string[]): Promise<HistoryBundle> {
  const [events, decisions, shares] = await Promise.all([
    supabase.from("review_events").select("*").eq("promotion_id", pid).order("created_at"),
    supabase.from("review_decisions").select("*").eq("promotion_id", pid).order("created_at"),
    versionIds.length
      ? supabase
          .from("share_reviews")
          .select("*")
          .in("submission_id", versionIds)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    events: check(events) as ReviewEvent[],
    decisions: check(decisions) as ReviewDecision[],
    shareReviews: ((shares.data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r["id"] as string,
      decision: r["decision"] as string,
      comment: (r["comment"] as string | null) ?? null,
      reviewer_name: ((r["reviewer_name"] ?? r["name"]) as string | null) ?? null,
      created_at: r["created_at"] as string,
    })),
  };
}

export const QUEUE_STATUSES = [
  "pending_review",
  "in_review",
  "escalated",
  "due_for_rereview",
] as const;
export async function fetchQueue(): Promise<Promotion[]> {
  return check(
    await supabase
      .from("promotions")
      .select("*")
      .in("review_status", [...QUEUE_STATUSES])
      .not("org_id", "is", null)
      .order("deadline_at", { ascending: true, nullsFirst: false })
      .order("submitted_at", { ascending: true })
      .limit(200),
  ) as Promotion[];
}

/** Business days (Sun–Thu by default) between two dates, used for the SLA overdue badge. */
export function businessDaysBetween(from: Date, to: Date, weekend: number[] = [5, 6]): number {
  let n = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (!weekend.includes(d.getDay())) n++;
  }
  return n;
}
export function isOverdue(
  p: Pick<Promotion, "deadline_at" | "submitted_at">,
  slaDays: number,
  now = new Date(),
  weekend?: number[],
): boolean {
  if (p.deadline_at && new Date(p.deadline_at) < now) return true;
  return Boolean(
    p.submitted_at && businessDaysBetween(new Date(p.submitted_at), now, weekend) > slaDays,
  );
}

export interface AuditFilters {
  orgId: string;
  eventType?: string;
  from?: string;
  to?: string;
}
export async function fetchAudit(f: AuditFilters): Promise<ReviewEvent[]> {
  let q = supabase
    .from("review_events")
    .select("*")
    .eq("org_id", f.orgId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (f.eventType) q = q.eq("event_type", f.eventType);
  if (f.from) q = q.gte("created_at", f.from);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59`);
  return check(await q) as ReviewEvent[];
}

/** CSV with a UTF-8 BOM (Excel shows Arabic correctly). Values are quoted; formulas are neutralised. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "﻿";
  const cols = Object.keys(rows[0]!);
  const cell = (v: unknown) => {
    let s =
      v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return (
    "﻿" +
    [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join(
      "\r\n",
    )
  );
}

export const rk = {
  history: (pid: string) => ["review-history", pid] as const,
  responses: (sid: string) => ["finding-responses", sid] as const,
  queue: ["review-queue"] as const,
  reasons: (orgId: string | null) => ["rejection-reasons", orgId] as const,
  members: (orgId: string) => ["org-members", orgId] as const,
};
export const useResponses = (sid: string | null | undefined) =>
  useQuery({
    queryKey: rk.responses(sid ?? ""),
    queryFn: () => fetchResponses(sid!),
    enabled: Boolean(sid),
  });
export const useMembers = (orgId: string | null | undefined) =>
  useQuery({
    queryKey: rk.members(orgId ?? ""),
    queryFn: () => fetchMembers(orgId!),
    enabled: Boolean(orgId),
  });
export const useReasons = (orgId: string | null) =>
  useQuery({ queryKey: rk.reasons(orgId), queryFn: () => fetchReasons(orgId) });
