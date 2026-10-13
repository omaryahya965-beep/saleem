// Data access for SALEEM. All reads go through RLS with the user's session; nothing here
// falls back to fixtures — demo content comes from `is_demo` rows in the database.
import type { Database } from "@/types/supabase";
import { supabase, IS_DEMO_MODE } from "@/lib/supabase";

type Tables = Database["public"]["Tables"];
export type Submission = Tables["submissions"]["Row"];
export type Finding = Tables["findings"]["Row"];
export type Rule = Tables["rules"]["Row"];
export type RulebookVersion = Tables["rulebook_versions"]["Row"];
export type Transcript = Tables["transcripts"]["Row"];
export type AnalysisRun = Tables["analysis_runs"]["Row"];
export type ComplianceLog = Tables["compliance_logs"]["Row"];
export type Platform = Database["public"]["Enums"]["platform"];
export type ProductCategory = Database["public"]["Enums"]["product_category"];
export type SubmissionKind = Database["public"]["Enums"]["submission_kind"];
export type OverallStatus = Database["public"]["Enums"]["overall_status"];

export const PLATFORMS: Platform[] = ["snapchat", "tiktok", "instagram", "x", "youtube"];
export const CATEGORIES: ProductCategory[] = [
  "food",
  "health",
  "beauty",
  "finance",
  "real_estate",
  "other",
];

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      "not_found" | "unauthorized" | "network" | "upload" | "unknown" = "unknown",
  ) {
    super(message);
  }
}

function fail(error: { message: string; code?: string } | null, fallback = "unknown"): never {
  const msg = error?.message ?? fallback;
  if (error?.code === "PGRST116") throw new ApiError(msg, "not_found");
  if (/fetch|network/i.test(msg)) throw new ApiError(msg, "network");
  throw new ApiError(msg);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------
export async function fetchRulebook(): Promise<{ version: RulebookVersion | null; rules: Rule[] }> {
  const [{ data: versions, error: vErr }, { data: rules, error: rErr }] = await Promise.all([
    supabase.from("rulebook_versions").select("*").eq("is_active", true).limit(1),
    supabase.from("rules").select("*").eq("is_active", true).order("code"),
  ]);
  if (vErr) fail(vErr);
  if (rErr) fail(rErr);
  return { version: versions?.[0] ?? null, rules: rules ?? [] };
}

// ---------------------------------------------------------------------------
// Dashboard list
// ---------------------------------------------------------------------------
export type DashboardFilter = "all" | "needs_fixes" | "review" | "ready" | "processing" | "failed";

export interface SubmissionListParams {
  userId: string | null;
  filter: DashboardFilter;
  search: string;
  page: number;
  pageSize: number;
}

export interface SubmissionListItem extends Submission {
  thumbnailUrl: string | null;
}

export async function fetchSubmissions(
  p: SubmissionListParams,
): Promise<{ items: SubmissionListItem[]; total: number }> {
  let q = supabase.from("submissions").select("*", { count: "exact" });
  if (p.userId && IS_DEMO_MODE) q = q.or(`user_id.eq.${p.userId},is_demo.eq.true`);
  else if (p.userId) q = q.eq("user_id", p.userId);
  else q = q.eq("is_demo", true);

  if (p.filter === "processing")
    q = q.in("status", ["queued", "extracting", "transcribing", "analyzing"]);
  else if (p.filter === "failed") q = q.eq("status", "failed");
  else if (p.filter !== "all") q = q.eq("overall_status", p.filter).eq("status", "done");

  const term = p.search.trim().replace(/[%,()]/g, " ");
  if (term) q = q.or(`title.ilike.%${term}%,caption.ilike.%${term}%`);

  const from = (p.page - 1) * p.pageSize;
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(from, from + p.pageSize - 1);
  if (error) fail(error);

  const rows = data ?? [];
  const paths = rows.map((r) => r.thumbnail_path).filter((x): x is string => Boolean(x));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return {
    items: rows.map((r) => ({
      ...r,
      thumbnailUrl: r.thumbnail_path ? (urls.get(r.thumbnail_path) ?? null) : null,
    })),
    total: count ?? rows.length,
  };
}

// ---------------------------------------------------------------------------
// Single submission (polled while processing)
// ---------------------------------------------------------------------------
export async function fetchSubmission(id: string): Promise<Submission> {
  const { data, error } = await supabase.from("submissions").select("*").eq("id", id).single();
  if (error || !data) fail(error, "not found");
  return data;
}

export const TERMINAL = new Set(["done", "failed"]);

// ---------------------------------------------------------------------------
// Full report bundle
// ---------------------------------------------------------------------------
export interface ReportBundle {
  submission: Submission;
  run: AnalysisRun | null;
  findings: Finding[];
  transcript: TranscriptSegment[];
  rules: Map<string, Rule>;
  rulebookVersion: string | null;
  parent: Submission | null;
  parentFindings: Finding[];
  log: ComplianceLog | null;
  mediaUrl: string | null;
}

async function latestRunWithFindings(submissionId: string) {
  const { data: runs, error } = await supabase
    .from("analysis_runs")
    .select("*")
    .eq("submission_id", submissionId)
    .order("started_at", { ascending: false })
    .limit(1);
  if (error) fail(error);
  const run = runs?.[0] ?? null;
  if (!run) return { run: null, findings: [] as Finding[] };
  const { data: findings, error: fErr } = await supabase
    .from("findings")
    .select("*")
    .eq("run_id", run.id)
    .order("t_start", { ascending: true, nullsFirst: false });
  if (fErr) fail(fErr);
  return { run, findings: findings ?? [] };
}

export async function fetchReport(id: string): Promise<ReportBundle> {
  const submission = await fetchSubmission(id);
  const [{ run, findings }, transcriptRes, rulebook, logRes] = await Promise.all([
    latestRunWithFindings(id),
    supabase.from("transcripts").select("*").eq("submission_id", id).maybeSingle(),
    fetchRulebook(),
    supabase.from("compliance_logs").select("*").eq("submission_id", id).maybeSingle(),
  ]);

  let parent: Submission | null = null;
  let parentFindings: Finding[] = [];
  if (submission.parent_id) {
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submission.parent_id)
      .maybeSingle();
    parent = data ?? null;
    if (parent) parentFindings = (await latestRunWithFindings(parent.id)).findings;
  }

  let mediaUrl: string | null = null;
  if (submission.file_path && !submission.media_deleted_at) {
    const { data } = await supabase.storage
      .from("media")
      .createSignedUrl(submission.file_path, 3600);
    mediaUrl = data?.signedUrl ?? null;
  }

  const segments = Array.isArray(transcriptRes.data?.segments)
    ? (transcriptRes.data.segments as unknown as TranscriptSegment[])
    : [];

  return {
    submission,
    run,
    findings,
    transcript: segments,
    rules: new Map(rulebook.rules.map((r) => [r.code, r])),
    rulebookVersion: run?.rulebook_version ?? rulebook.version?.version_label ?? null,
    parent,
    parentFindings,
    log: logRes.data ?? null,
    mediaUrl,
  };
}

// ---------------------------------------------------------------------------
// Create submission + trigger analysis
// ---------------------------------------------------------------------------
export interface NewSubmissionInput {
  userId: string;
  kind: SubmissionKind;
  file: File | null;
  /** JPEG poster frame (video) for thumbnails. */
  poster: Blob | null;
  durationSeconds: number | null;
  textContent: string;
  caption: string;
  title: string;
  platform: Platform;
  productCategory: ProductCategory;
  isPaidAd: boolean;
  hasWrittenContract: boolean;
  aiUsed: boolean;
  licenseNo: string;
  parentId: string | null;
}

export async function sha256Hex(data: Blob | string): Promise<string> {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : await data.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSubmission(
  input: NewSubmissionInput,
  onStage?: (stage: "hashing" | "uploading" | "saving") => void,
): Promise<string> {
  const id = crypto.randomUUID();
  const folder = `${input.userId}/${id}`;
  let filePath: string | null = null;
  let thumbPath: string | null = null;

  onStage?.("hashing");
  const sha256 = await sha256Hex(input.file ?? `${input.caption}\n${input.textContent}`);

  if (input.file) {
    onStage?.("uploading");
    const ext = (
      input.file.name.split(".").pop() || (input.kind === "video" ? "mp4" : "jpg")
    ).toLowerCase();
    filePath = `${folder}/original.${ext}`;
    const { error } = await supabase.storage
      .from("media")
      .upload(filePath, input.file, { contentType: input.file.type || undefined, upsert: false });
    if (error) throw new ApiError(error.message, "upload");
    if (input.poster) {
      thumbPath = `${folder}/thumb.jpg`;
      const { error: tErr } = await supabase.storage
        .from("media")
        .upload(thumbPath, input.poster, { contentType: "image/jpeg" });
      if (tErr) thumbPath = null; // thumbnail is cosmetic; never block the check on it
    } else if (input.kind === "image") {
      thumbPath = filePath;
    }
  }

  onStage?.("saving");
  const { error } = await supabase.from("submissions").insert({
    id,
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    caption: input.caption,
    text_content: input.kind === "text" ? input.textContent : null,
    platform: input.platform,
    product_category: input.productCategory,
    is_paid_ad: input.isPaidAd,
    has_written_contract: input.hasWrittenContract,
    ai_used: input.aiUsed,
    mawthooq_license_no: input.licenseNo.trim() || null,
    parent_id: input.parentId,
    sha256,
    duration_seconds: input.durationSeconds,
    file_path: filePath,
    thumbnail_path: thumbPath,
    status: "queued",
    progress: 0,
  });
  if (error) fail(error);

  void triggerAnalysis(id);
  return id;
}

/** Starts (or resumes) the analysis pipeline. Uses the signed-in user's JWT. */
export async function triggerAnalysis(submissionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("analyze", {
    body: { submission_id: submissionId },
  });
  if (error) console.warn("[analyze] invoke failed:", error.message);
}

export async function deleteMedia(submissionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("cleanup-media", {
    body: { submission_id: submissionId },
  });
  if (error) throw new ApiError(error.message);
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
export type Profile = Tables["profiles"]["Row"];

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) fail(error);
  return data;
}

export async function updateProfile(
  userId: string,
  patch: Pick<Profile, "display_name" | "mawthooq_license_no" | "platforms">,
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert({ id: userId, ...patch });
  if (error) fail(error);
}
