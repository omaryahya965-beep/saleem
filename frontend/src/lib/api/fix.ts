// SALEEM Fix client (D178). Jobs are created and accepted through RPCs; plans come from the `fix` Edge Function.
import { useQuery } from "@tanstack/react-query";
import type { Json } from "@/types/supabase";
import { supabase } from "@/lib/supabase";
import { ApiError, createSubmission, type NewSubmissionInput } from "./data";

export interface FixPlanItem {
  finding_ids: string[];
  problem_ar: string;
  evidence_ar: string;
  correction_ar: string;
  affected: string;
  media_edit_needed: boolean;
  voiceover_needed: boolean;
  human_evidence_required: boolean;
  ai_can_fix: boolean;
}
export interface FixProposal {
  caption: string;
  script: string;
  disclosures: string[];
  changes: { before: string; after: string; reason_ar: string }[];
  limitations: string[];
}
export interface CorrectionJob {
  id: string;
  promotion_id: string;
  source_submission_id: string;
  method: "text_correction" | "media_edit" | "replacement";
  status: "draft" | "generating" | "ready" | "accepting" | "accepted" | "cancelled" | "failed";
  selected_finding_ids: string[];
  preferences: Record<string, unknown>;
  instructions: string | null;
  plan: FixPlanItem[] | null;
  proposal: FixProposal | null;
  edited_proposal: FixProposal | null;
  provider: string | null;
  model: string | null;
  estimated_cost_usd: number | null;
  usage: { cost_usd?: number | null } | null;
  error_code: string | null;
  attempts: number;
  result_submission_id: string | null;
  created_at: string;
}
export interface FixEstimate {
  estimate: { inputTokens: number; outputTokens: number; usd: number | null; model: string };
  quota: { ok: boolean; reasons: string[]; used: number; limit: number; remaining: number } | null;
  text_provider_configured: boolean;
  media_providers: {
    method: string;
    configured: boolean;
    provider: string | null;
    reason_ar: string;
  }[];
  status: CorrectionJob["status"];
}

function check<T>(res: {
  data: T;
  error: { message: string; code?: string } | null;
}): NonNullable<T> {
  if (res.error) throw ApiError.from(res.error);
  return res.data as NonNullable<T>;
}
// RPCs and the table are new in this release; typed locally to keep the generated types untouched.
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

export const fixKeys = {
  can: (pid: string) => ["fix-can", pid] as const,
  jobs: (pid: string) => ["fix-jobs", pid] as const,
  estimate: (jid: string) => ["fix-estimate", jid] as const,
};

export async function canFix(pid: string) {
  return check(await rpc("can_fix_promotion", { _pid: pid })) as {
    ok: boolean;
    reasons: string[];
    used: number;
    limit: number;
    remaining: number;
  };
}
export async function listJobs(pid: string): Promise<CorrectionJob[]> {
  const res = await (
    supabase.from("correction_jobs" as never) as unknown as {
      select: (c: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          order: (
            k: string,
            o: { ascending: boolean },
          ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("promotion_id", pid)
    .order("created_at", { ascending: false });
  return check(res) as CorrectionJob[];
}
export const useJobs = (pid: string) =>
  useQuery({
    queryKey: fixKeys.jobs(pid),
    queryFn: () => listJobs(pid),
    // While generating, poll until the function stores the plan (no new request is made).
    refetchInterval: (q) => (q.state.data?.some((j) => j.status === "generating") ? 2000 : false),
  });

export async function createJob(
  pid: string,
  v: {
    findings: string[];
    preferences: Record<string, unknown>;
    instructions: string;
    key: string;
  },
) {
  return check(
    await rpc("create_correction_job", {
      _pid: pid,
      _method: "text_correction",
      _findings: v.findings,
      _preferences: v.preferences as Json,
      _instructions: v.instructions || null,
      _key: v.key,
    }),
  ) as string;
}
async function invoke(jobId: string, action: "estimate" | "generate") {
  const { data, error } = await supabase.functions.invoke("fix", {
    body: { job_id: jobId, action },
  });
  if (error) {
    // supabase-js wraps non-2xx: read the JSON body for our `code:` errors.
    const ctx = (error as { context?: Response }).context;
    const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
    throw new ApiError(String(body?.error ?? error.message), "unknown");
  }
  return data;
}
export const estimateJob = (jobId: string) => invoke(jobId, "estimate") as Promise<FixEstimate>;
export const generateJob = (jobId: string) => invoke(jobId, "generate");
export async function cancelJob(jobId: string) {
  check(await rpc("cancel_correction_job", { _id: jobId }));
}

/**
 * Accept: atomic claim → new TEXT version (corrected script + caption) under the same advertisement → link.
 * The new version starts its own analysis (mandatory re-analysis); nothing is approved or inherited.
 */
export async function acceptJob(
  job: CorrectionJob,
  edited: FixProposal,
  base: Omit<
    NewSubmissionInput,
    "kind" | "file" | "poster" | "durationSeconds" | "textContent" | "caption" | "parentId"
  >,
): Promise<string> {
  check(await rpc("begin_accept_correction", { _id: job.id, _edited: edited as unknown as Json }));
  let sid: string;
  try {
    sid = await createSubmission({
      ...base,
      kind: "text",
      file: null,
      poster: null,
      durationSeconds: null,
      textContent: [edited.script, ...edited.disclosures.filter((d) => !edited.script.includes(d))]
        .filter(Boolean)
        .join("\n"),
      caption: edited.caption,
      parentId: job.source_submission_id,
      aiUsed: true,
    });
  } catch (e) {
    await rpc("abort_accept_correction", { _id: job.id });
    throw e;
  }
  check(await rpc("finish_accept_correction", { _id: job.id, _sid: sid }));
  return sid;
}
