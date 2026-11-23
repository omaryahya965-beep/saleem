// Personal workspace API (D211): the individual's own workspace (not an organisation, not a role), regulatory
// authority selection and recommendation, verified coverage per authority, and personal AI allowances.
// Tables/RPCs added in 20261122100000 are not in the generated types yet.
import { supabase } from "@/lib/supabase";

export const AUTHORITIES = [
  "GMEDIA",
  "MC",
  "SDAIA",
  "SFDA",
  "SAMA",
  "CMA",
  "IA",
  "MT",
  "REGA",
  "MOHU",
] as const;
export type Authority = (typeof AUTHORITIES)[number];

export interface PersonalWorkspace {
  user_id: string;
  display_name: string | null;
  is_demo: boolean;
  default_authorities: Authority[];
  created_at: string;
}
export interface AuthorityCoverage {
  authority: Authority;
  packs: { code: string; name_ar: string; name_en: string; active: number; draft: number }[];
  active_rules: number;
  draft_rules: number;
  in_force_sources: number;
}
export interface Allowance {
  ok: boolean;
  used: number;
  limit: number;
}
export type PersonalAllowances = Record<"analysis" | "script" | "correction" | "ask", Allowance>;

const from = (t: string) =>
  (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from(t);
const rpc = supabase.rpc.bind(supabase) as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const fail = (e: { message: string } | null) => {
  if (e) throw new Error(e.message.match(/code:([a-z_]+)/)?.[1] ?? e.message);
};

export async function fetchPersonalWorkspace(): Promise<PersonalWorkspace | null> {
  const { data, error } = await from("personal_workspaces").select("*").maybeSingle();
  fail(error);
  return (data as PersonalWorkspace | null) ?? null;
}
/** «Personal use»: creates only the caller's own workspace (never an organisation, membership or role). */
export async function ensurePersonalWorkspace(displayName?: string): Promise<void> {
  const { error } = await rpc("ensure_personal_workspace", { _display_name: displayName ?? null });
  fail(error);
}
export async function savePersonalPreferences(
  displayName: string,
  authorities: Authority[],
): Promise<void> {
  const { error } = await rpc("save_personal_preferences", {
    _display_name: displayName,
    _authorities: authorities,
  });
  fail(error);
}
export async function fetchAuthorityCoverage(): Promise<AuthorityCoverage[]> {
  const { data, error } = await rpc("authority_coverage");
  fail(error);
  return (data as AuthorityCoverage[]) ?? [];
}
export async function fetchPersonalAllowances(): Promise<PersonalAllowances | null> {
  const { data, error } = await rpc("personal_ai_allowances");
  fail(error);
  return (data as PersonalAllowances | null) ?? null;
}
export interface PersonalCorrection {
  id: string;
  promotion_id: string;
  method: "text_correction" | "media_edit" | "replacement";
  status: string;
  updated_at: string;
  result_submission_id: string | null;
}
/** Corrections the user accepted in their personal workspace (RLS: own jobs only). */
export async function listPersonalCorrections(): Promise<PersonalCorrection[]> {
  const { data, error } = await from("correction_jobs")
    .select("id, promotion_id, method, status, updated_at, result_submission_id")
    .is("org_id", null)
    .eq("status", "accepted")
    .order("updated_at", { ascending: false })
    .limit(5);
  fail(error);
  return (data as PersonalCorrection[]) ?? [];
}

export interface SavedVideo {
  id: string;
  title: string | null;
  promotion_id: string | null;
  version_no: number | null;
  created_at: string;
  duration_seconds: number | null;
  overall_status: "ready" | "needs_fixes" | "review" | null;
}
/** The user's own personal video versions (originals, corrected and Studio-generated). */
export async function listSavedVideos(userId: string): Promise<SavedVideo[]> {
  const { data, error } = await from("submissions")
    .select("id, title, promotion_id, version_no, created_at, duration_seconds, overall_status")
    .eq("user_id", userId)
    .is("org_id", null)
    .eq("kind", "video")
    .not("file_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);
  fail(error);
  return (data as SavedVideo[]) ?? [];
}

/** D219: what the personal dashboard shows per recent advertisement (all real rows; RLS: own versions only). */
export interface VersionCard {
  id: string;
  kind: string | null;
  durationSeconds: number | null;
  previewUrl: string | null;
  /** Findings of the version's latest analysis run (null when it was never analysed). */
  violations: number | null;
  warnings: number | null;
}
/** Preview (signed thumbnail), duration and finding counts of the latest run, for a few versions. */
export async function fetchVersionCards(ids: string[]): Promise<Map<string, VersionCard>> {
  const out = new Map<string, VersionCard>();
  if (!ids.length) return out;
  const [subs, runs] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, kind, duration_seconds, thumbnail_path, media_deleted_at")
      .in("id", ids),
    supabase
      .from("analysis_runs")
      .select("id, submission_id, started_at")
      .in("submission_id", ids)
      .order("started_at", { ascending: false }),
  ]);
  fail(subs.error);
  fail(runs.error);
  const latest = new Map<string, string>();
  for (const r of runs.data ?? [])
    if (!latest.has(r.submission_id)) latest.set(r.submission_id, r.id);
  const runIds = [...latest.values()];
  const counts = new Map<string, { violation: number; warning: number }>();
  if (runIds.length) {
    const f = await supabase.from("findings").select("run_id, severity").in("run_id", runIds);
    fail(f.error);
    for (const row of f.data ?? []) {
      const c = counts.get(row.run_id) ?? { violation: 0, warning: 0 };
      c[row.severity] += 1;
      counts.set(row.run_id, c);
    }
  }
  const rows = subs.data ?? [];
  const paths = rows
    .filter((r) => r.thumbnail_path && !r.media_deleted_at)
    .map((r) => r.thumbnail_path as string);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  for (const r of rows) {
    const run = latest.get(r.id);
    const c = run ? (counts.get(run) ?? { violation: 0, warning: 0 }) : null;
    out.set(r.id, {
      id: r.id,
      kind: r.kind,
      durationSeconds: r.duration_seconds,
      previewUrl:
        r.thumbnail_path && !r.media_deleted_at ? (urls.get(r.thumbnail_path) ?? null) : null,
      violations: c ? c.violation : null,
      warnings: c ? c.warning : null,
    });
  }
  return out;
}
