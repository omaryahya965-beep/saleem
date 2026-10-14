// SALEEM analyze — resumable analysis pipeline.
//
// POST { submission_id }  with the user's JWT.
// Verifies the caller owns the submission, replies 202 immediately and runs the steps in the
// background. Each step persists its output, so a retry resumes after the last finished step:
//   1. transcribe   — audio track → Arabic segments with timestamps (OpenAI)
//   2. llm          — frames (1/s, ≤60, ≤768 px) + transcript + caption → findings + on-screen text
//   3. deterministic— regex checks over transcript, on-screen text, caption and metadata
//   4. merge        — validate rule codes, downgrade weak evidence, dedupe within 3 s, status
// Progress, errors, models, prompt/rulebook versions, durations, tokens and cost are stored.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { mergeAndFilterFindings } from "../_shared/pipeline/merge.ts";
import { audioCost, textCost } from "../_shared/pipeline/cost.ts";
import { PROMPT_VERSION } from "../_shared/pipeline/schema.ts";
import { analysisProvider, config, transcriptionProvider } from "../_shared/providers/index.ts";
import { ProviderError } from "../_shared/providers/types.ts";
import { runDeterministicChecks } from "../_shared/rules/deterministic.ts";
import type { Finding, OnScreenText, RuleRecord, SubmissionData, TranscriptSegment } from "../_shared/types.ts";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { checkEmail, emailProvider } from "../_shared/notify.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const env = (k: string) => Deno.env.get(k);
const RATE_LIMIT_PER_HOUR = Number(env("ANALYZE_RATE_LIMIT_PER_HOUR") ?? 30);
const MAX_FRAMES = 62; // 1/s up to 60 + first/last
const CANCELLED = "cancelled_by_user";

type Db = SupabaseClient;

class Cancelled extends Error {}

function friendlyError(e: unknown): string {
  if (e instanceof ProviderError) {
    if (e.status === 401) return "تعذّر الاتصال بمزوّد التحليل (مفتاح غير صالح). أبلغ فريق سَليم.";
    if (e.status === 429) return "مزوّد التحليل مشغول حالياً. أعد المحاولة بعد دقيقة.";
    if (e.retryable) return "انقطع الاتصال بمزوّد التحليل. أعد المحاولة.";
    return `تعذّر تحليل المحتوى: ${e.message.slice(0, 160)}`;
  }
  return "حدث خطأ غير متوقع أثناء الفحص. أعد المحاولة.";
}

async function setProgress(db: Db, id: string, patch: Record<string, unknown>) {
  await db.from("submissions").update({ ...patch, heartbeat_at: new Date().toISOString() }).eq("id", id);
}

async function assertNotCancelled(db: Db, id: string) {
  const { data } = await db.from("submissions").select("status, error_message").eq("id", id).single();
  if (data?.status === "failed" && data.error_message === CANCELLED) throw new Cancelled();
}

async function listFrames(db: Db, folder: string): Promise<{ t: number; path: string }[]> {
  const { data } = await db.storage.from("media").list(`${folder}/frames`, { limit: 200, sortBy: { column: "name", order: "asc" } });
  return (data ?? [])
    .filter((f) => /^\d+\.jpg$/.test(f.name))
    .map((f) => ({ t: Number(f.name.replace(".jpg", "")) / 1000, path: `${folder}/frames/${f.name}` }))
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_FRAMES);
}

/** In-app notification + email (respecting the profile's notify_email). Never throws. */
async function notifyUser(db: Db, sub: SubmissionData & { user_id: string; title?: string | null }, ok: boolean, status: string | null) {
  try {
    await db.from("notifications").insert({
      user_id: sub.user_id,
      kind: ok ? "check_done" : "check_failed",
      submission_id: sub.id,
      payload: { title: sub.title ?? "", overall_status: status },
    });
    const { data: profile } = await db.from("profiles").select("notify_email, preferred_lang").eq("id", sub.user_id).maybeSingle();
    if (profile?.notify_email === false) return;
    const { data: u } = await db.auth.admin.getUserById(sub.user_id);
    if (!u?.user?.email) return;
    const base = env("APP_URL") ?? "https://saleem.app";
    const msg = checkEmail({ ok, title: sub.title || "—", status, url: `${base}/checks/${sub.id}`, lang: profile?.preferred_lang === "en" ? "en" : "ar" });
    await emailProvider(env).send({ to: u.user.email, ...msg });
  } catch (e) {
    log("notify_failed", { submission_id: sub.id, error: (e as Error).message });
  }
}

async function runPipeline(db: Db, sub: SubmissionData & { user_id: string }, runId: string) {
  const cfg = config(env);
  const folder = `${sub.user_id}/${sub.id}`;
  const durations: Record<string, number> = {};
  const timed = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    try {
      return await fn();
    } finally {
      durations[name] = Date.now() - t0;
      log("step_done", { submission_id: sub.id, step: name, ms: durations[name] });
    }
  };

  const { data: runRow } = await db.from("analysis_runs").select("*").eq("id", runId).single();
  const outputs: Record<string, unknown> = (runRow?.step_outputs as Record<string, unknown>) ?? {};
  const saveRun = (patch: Record<string, unknown>) => db.from("analysis_runs").update(patch).eq("id", runId);

  // ---- 1. Transcribe ---------------------------------------------------------------------
  await setProgress(db, sub.id, { status: "transcribing", current_step: "transcribe", progress: 10 });
  let segments: TranscriptSegment[] = [];
  let asrSeconds = Number(outputs.asr_seconds ?? 0);
  const { data: existing } = await db.from("transcripts").select("segments").eq("submission_id", sub.id).maybeSingle();
  if (existing) {
    segments = (existing.segments as TranscriptSegment[]) ?? [];
  } else if (sub.kind === "video") {
    const audioPath = sub.audio_path ?? sub.file_path;
    if (!audioPath) throw new ProviderError("لا يوجد ملف صوتي أو فيديو لهذا الفحص", false);
    const result = await timed("transcribe", async () => {
      const { data: blob, error } = await db.storage.from("media").download(audioPath);
      if (error || !blob) throw new ProviderError(`تعذّر تنزيل الملف الصوتي: ${error?.message ?? "missing"}`, true);
      if (blob.size > 25 * 1024 * 1024) throw new ProviderError("الملف الصوتي أكبر من 25 م.ب", false);
      return transcriptionProvider(env).transcribe(blob, audioPath.split("/").pop() ?? "audio.wav");
    });
    segments = result.segments;
    asrSeconds = result.seconds;
    await db.from("transcripts").upsert({
      submission_id: sub.id,
      full_text: result.full_text,
      segments,
      language: "ar",
      provider: `${result.provider}:${result.model}`,
    });
    outputs.asr_seconds = asrSeconds;
    outputs.asr_model = result.model;
    await saveRun({ asr_model: result.model, asr_provider: result.provider, step_outputs: outputs });
  }
  await assertNotCancelled(db, sub.id);

  // ---- 2. Frames + vision/reasoning model -----------------------------------------------
  await setProgress(db, sub.id, { status: "analyzing", current_step: "llm", progress: 40 });
  const { data: runMeta } = await db.from("analysis_runs").select("rulebook_version_id").eq("id", runId).single();
  let rulesQuery = db.from("rules").select("*").eq("is_active", true).order("code");
  if (runMeta?.rulebook_version_id) rulesQuery = rulesQuery.eq("rulebook_version_id", runMeta.rulebook_version_id);
  const { data: rulesData, error: rulesErr } = await rulesQuery;
  if (rulesErr) throw rulesErr;
  const rules = (rulesData ?? []) as RuleRecord[];
  const validCodes = new Set(rules.map((r) => r.code));

  const frames = sub.kind === "text" ? [] : await listFrames(db, folder);
  const { count: frameRows } = await db.from("frames").select("id", { count: "exact", head: true }).eq("submission_id", sub.id);
  if (frames.length && !frameRows) {
    await db.from("frames").insert(frames.map((f) => ({ submission_id: sub.id, t_seconds: f.t, image_path: f.path })));
  }

  let llmFindings: Finding[] = [];
  let onScreen: OnScreenText[] = [];
  if (outputs.llm_done) {
    llmFindings = (outputs.llm_findings as Finding[]) ?? [];
    onScreen = (runRow?.on_screen_text as OnScreenText[]) ?? [];
  } else {
    const signed = frames.length
      ? ((await db.storage.from("media").createSignedUrls(frames.map((f) => f.path), 900)).data ?? [])
      : [];
    const frameInputs = frames
      .map((f, i) => ({ t: f.t, url: signed[i]?.signedUrl ?? "" }))
      .filter((f) => f.url);
    if (!frameInputs.length && sub.kind !== "text") {
      // Media already deleted (re-run): reuse on-screen text read in the previous run.
      const { data: prev } = await db.from("analysis_runs").select("on_screen_text").eq("submission_id", sub.id).neq("id", runId).order("started_at", { ascending: false }).limit(1).maybeSingle();
      onScreen = ((prev?.on_screen_text as OnScreenText[]) ?? []);
    }
    const analysis = await timed("llm", () =>
      analysisProvider(env).analyze({ submission: sub, segments, rules, frames: frameInputs, duration: sub.duration_seconds ?? null }),
    );
    llmFindings = analysis.findings;
    onScreen = analysis.on_screen_text;
    outputs.llm_done = true;
    outputs.llm_findings = llmFindings;
    outputs.llm_attempts = analysis.attempts;
    await saveRun({
      llm_model: analysis.model,
      llm_provider: analysis.provider,
      raw_llm_output: analysis.raw,
      token_usage: analysis.usage,
      on_screen_text: onScreen,
      frames_count: frameInputs.length,
      step_outputs: outputs,
    });
    // Store on-screen text on the nearest frame rows (for the report and audits).
    for (const o of onScreen) {
      await db.from("frames").update({ ocr_text: o.text }).eq("submission_id", sub.id).gte("t_seconds", o.t - 0.5).lte("t_seconds", o.t + 0.5);
    }
  }
  await assertNotCancelled(db, sub.id);

  // ---- 3. Deterministic checks ---------------------------------------------------------
  await setProgress(db, sub.id, { current_step: "deterministic", progress: 85 });
  const det = await timed("deterministic", async () => runDeterministicChecks(sub, segments, onScreen));

  // ---- 4. Merge + persist ----------------------------------------------------------------
  await setProgress(db, sub.id, { current_step: "merge", progress: 95 });
  const merged = mergeAndFilterFindings([...det.findings, ...llmFindings], validCodes);
  if (merged.dropped.unknownRule.length) log("dropped_unknown_rules", { submission_id: sub.id, codes: merged.dropped.unknownRule });

  const { data: frameIndex } = await db.from("frames").select("id, t_seconds").eq("submission_id", sub.id);
  const nearestFrame = (t: number | null | undefined) => {
    if (t == null || !frameIndex?.length) return null;
    return frameIndex.reduce((a, b) => (Math.abs(Number(b.t_seconds) - t) < Math.abs(Number(a.t_seconds) - t) ? b : a)).id;
  };

  await db.from("findings").delete().eq("run_id", runId);
  if (merged.mergedFindings.length) {
    const { error } = await db.from("findings").insert(
      merged.mergedFindings.map((f) => ({
        run_id: runId,
        submission_id: sub.id,
        rule_code: f.rule_code,
        severity: f.severity,
        t_start: f.t_start,
        t_end: f.t_end,
        evidence_type: f.evidence_type,
        evidence_text: f.evidence_text,
        evidence_frame_id: f.evidence_type === "frame" ? nearestFrame(f.evidence_frame_t ?? f.t_start) : null,
        explanation_ar: f.explanation_ar,
        explanation_en: f.explanation_en,
        fix_ar: f.fix_ar,
        fix_en: f.fix_en,
        confidence: f.confidence,
        source: f.source,
      })),
    );
    if (error) throw error;
  }

  await db.from("compliance_logs").upsert({ submission_id: sub.id, content_hash: sub.sha256 ?? "", generated_at: new Date().toISOString() });

  const usage = (await db.from("analysis_runs").select("token_usage, llm_model, asr_model").eq("id", runId).single()).data;
  const cost =
    textCost(usage?.llm_model ?? cfg.llmModel, (usage?.token_usage as never) ?? { input_tokens: 0, output_tokens: 0 }, env(`PRICE_${(usage?.llm_model ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`)) +
    audioCost(usage?.asr_model ?? cfg.transcriptionModel, asrSeconds);

  await saveRun({
    status: "done",
    finished_at: new Date().toISOString(),
    durations_ms: { ...(runRow?.durations_ms as object), ...durations },
    cost_usd: Number(cost.toFixed(5)),
    step_outputs: {
      ...outputs,
      deterministic_count: det.findings.length,
      llm_count: llmFindings.length,
      merged_count: merged.mergedFindings.length,
      dropped: merged.dropped,
      promotional: det.promotional,
      discount_codes: det.discountCodes,
    },
  });
  await setProgress(db, sub.id, {
    status: "done",
    progress: 100,
    current_step: "done",
    overall_status: merged.overallStatus,
    analyzed_at: new Date().toISOString(),
    error_message: null,
  });
  await db.rpc("seal_compliance_log", { _sid: sub.id });
  await notifyUser(db, sub, true, merged.overallStatus);
  log("pipeline_done", { submission_id: sub.id, status: merged.overallStatus, findings: merged.mergedFindings.length, cost_usd: cost, durations });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // --- Auth: verify the JWT and resolve the user (the gateway also verifies the signature).
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const { data: auth, error: authErr } = await db.auth.getUser(token);
  if (authErr || !auth.user) return json({ error: "invalid session" }, 401);
  const userId = auth.user.id;

  const body = await req.json().catch(() => ({}));
  const submissionId = typeof body.submission_id === "string" ? body.submission_id : null;
  if (!submissionId) return json({ error: "submission_id is required" }, 400);

  const { data: sub, error: subErr } = await db.from("submissions").select("*").eq("id", submissionId).maybeSingle();
  if (subErr) return json({ error: "lookup failed" }, 500);
  if (!sub || sub.user_id !== userId || sub.is_demo) return json({ error: "not found" }, 404);
  if (sub.status === "done") return json({ status: "done" }, 200);
  if (sub.status === "failed" && sub.error_message === CANCELLED) return json({ status: "cancelled" }, 409);

  // Another worker is active if the heartbeat is fresh (idempotent re-invocation).
  const fresh = sub.heartbeat_at && Date.now() - new Date(sub.heartbeat_at).getTime() < 45_000;
  if (fresh && !["queued", "failed"].includes(sub.status)) return json({ status: "running" }, 202);

  // --- Rate limit: analyses started per user per hour.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) > RATE_LIMIT_PER_HOUR) return json({ error: "rate_limited" }, 429);

  // --- Run row: reuse the latest unfinished run so steps resume.
  const cfg = config(env);
  const { data: version } = await db.from("rulebook_versions").select("id, version_label").eq("is_active", true).limit(1).maybeSingle();
  let { data: run } = await db
    .from("analysis_runs")
    .select("id, status")
    .eq("submission_id", sub.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run || run.status === "done") {
    const created = await db
      .from("analysis_runs")
      .insert({
        submission_id: sub.id,
        rulebook_version_id: version?.id ?? null,
        rulebook_version: version?.version_label ?? null,
        llm_model: cfg.llmModel,
        llm_provider: cfg.llmProvider,
        asr_model: sub.kind === "video" ? cfg.transcriptionModel : null,
        asr_provider: sub.kind === "video" ? cfg.transcriptionProvider : null,
        prompt_version: PROMPT_VERSION,
      })
      .select("id, status")
      .single();
    if (created.error) return json({ error: "could not create run" }, 500);
    run = created.data;
  } else {
    await db.from("analysis_runs").update({ status: "running", error: null }).eq("id", run.id);
  }

  await db
    .from("submissions")
    .update({ status: "transcribing", error_message: null, attempts: (sub.attempts ?? 0) + 1, heartbeat_at: new Date().toISOString() })
    .eq("id", sub.id);
  log("pipeline_start", { submission_id: sub.id, user_id: userId, run_id: run.id, attempt: (sub.attempts ?? 0) + 1, kind: sub.kind });

  const work = runPipeline(db, sub, run.id).catch(async (e) => {
    if (e instanceof Cancelled) {
      await db.from("analysis_runs").update({ status: "failed", error: CANCELLED, finished_at: new Date().toISOString() }).eq("id", run!.id);
      log("pipeline_cancelled", { submission_id: sub.id });
      return;
    }
    const message = friendlyError(e);
    log("pipeline_failed", { submission_id: sub.id, error: (e as Error)?.message?.slice(0, 500) });
    await db.from("analysis_runs").update({ status: "failed", error: (e as Error)?.message?.slice(0, 1000) ?? "unknown" }).eq("id", run!.id);
    await notifyUser(db, sub, false, null);
    await db.from("submissions").update({ status: "failed", error_message: message }).eq("id", sub.id).or(`error_message.is.null,error_message.neq.${CANCELLED}`);
  });

  if (typeof EdgeRuntime !== "undefined") {
    EdgeRuntime.waitUntil(work);
    return json({ status: "accepted", run_id: run.id }, 202);
  }
  await work;
  return json({ status: "finished", run_id: run.id }, 200);
});
