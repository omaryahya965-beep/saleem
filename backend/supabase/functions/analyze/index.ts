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
import { errorToken } from "../_shared/providers/errors.ts";
import { runDeterministicChecks } from "../_shared/rules/deterministic.ts";
import { decideAudioMode, filterSegments, shouldTranscribe, type AudioMode, type AudioProbe } from "../_shared/rules/speech.ts";
import type { Finding, OnScreenText, RuleRecord, SubmissionData, TranscriptSegment } from "../_shared/types.ts";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { evidencePath, pixelateRgba } from "../_shared/media/blur.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { checkEmail, emailProvider } from "../_shared/notify.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const env = (k: string) => Deno.env.get(k);
const RATE_LIMIT_PER_HOUR = Number(env("ANALYZE_RATE_LIMIT_PER_HOUR") ?? 30);
const MAX_FRAMES = 62; // 1/s up to 60 + first/last
const CANCELLED = "cancelled_by_user";

type Db = SupabaseClient;

class Cancelled extends Error {}

/** Stored in submissions.error_message as a code the UI translates (Arabic/English). */
function errorMessageFor(e: unknown): string {
  if (e instanceof ProviderError && e.info) return errorToken(e.info.code);
  if (e instanceof ProviderError) return errorToken("unknown");
  return "code:pipeline_unexpected";
}

async function setProgress(db: Db, id: string, patch: Record<string, unknown>) {
  await db.from("submissions").update({ ...patch, heartbeat_at: new Date().toISOString() }).eq("id", id);
}

async function assertNotCancelled(db: Db, id: string) {
  const { data } = await db.from("submissions").select("status, error_message").eq("id", id).single();
  if (data?.status === "failed" && data.error_message === CANCELLED) throw new Cancelled();
}

/**
 * Stores a pixelated copy of every evidence frame and points the frame row at it (blurred = true).
 * Frames can show people, including minors, so no unblurred evidence ever reaches the browser.
 * A frame that cannot be blurred is unlinked from its findings instead of being shown raw.
 */
async function blurEvidenceFrames(db: Db, folder: string, frameIds: string[]) {
  if (!frameIds.length) return;
  const { data: rows } = await db.from("frames").select("id, image_path, blurred").in("id", frameIds);
  await Promise.all((rows ?? []).filter((row) => !row.blurred).map(async (row) => {
    try {
      const { data: blob, error } = await db.storage.from("media").download(row.image_path);
      if (error || !blob) throw error ?? new Error("missing frame");
      const img = await Image.decode(new Uint8Array(await blob.arrayBuffer()));
      pixelateRgba(img.bitmap, img.width, img.height);
      const path = evidencePath(folder, row.id);
      const up = await db.storage.from("media").upload(path, await img.encodeJPEG(70), { contentType: "image/jpeg", upsert: true });
      if (up.error) throw up.error;
      await db.from("frames").update({ image_path: path, blurred: true }).eq("id", row.id);
    } catch (e) {
      log("evidence_blur_failed", { frame_id: row.id, error: String((e as Error)?.message ?? e).slice(0, 200) });
      await db.from("findings").update({ evidence_frame_id: null }).eq("evidence_frame_id", row.id);
    }
  }));
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
  const pipelineStart = Date.now();
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

  // LLM inputs (rules, frame list + rows, signed URLs) do not depend on the transcript:
  // prepare them while transcription runs.
  const prepared = timed("prepare", async () => {
    let rulesQuery = db.from("rules").select("*").eq("is_active", true).order("code");
    if (runRow?.rulebook_version_id) rulesQuery = rulesQuery.eq("rulebook_version_id", runRow.rulebook_version_id);
    const [{ data: rulesData, error: rulesErr }, frames, { count: frameRows }] = await Promise.all([
      rulesQuery,
      sub.kind === "text" ? Promise.resolve([]) : listFrames(db, folder),
      db.from("frames").select("id", { count: "exact", head: true }).eq("submission_id", sub.id),
    ]);
    if (rulesErr) throw rulesErr;
    const [, signedRes] = await Promise.all([
      frames.length && !frameRows
        ? db.from("frames").insert(frames.map((f) => ({ submission_id: sub.id, t_seconds: f.t, image_path: f.path })))
        : Promise.resolve(null),
      frames.length && !outputs.llm_done
        ? db.storage.from("media").createSignedUrls(frames.map((f) => f.path), 900)
        : Promise.resolve({ data: [] }),
    ]);
    return { rules: (rulesData ?? []) as RuleRecord[], frames, signed: (signedRes?.data ?? []) as { signedUrl?: string | null }[] };
  });
  prepared.catch(() => {}); // awaited below; avoids an unhandled rejection while transcription runs

  // ---- 1. Transcribe ---------------------------------------------------------------------
  await setProgress(db, sub.id, { status: "transcribing", current_step: "transcribe", progress: 10 });
  let segments: TranscriptSegment[] = [];
  let asrSeconds = Number(outputs.asr_seconds ?? 0);
  let audioMode: AudioMode | null = (outputs.audio_mode as AudioMode | undefined) ?? null;
  const probe = (sub.audio_probe ?? null) as AudioProbe | null;
  const { data: existing } = await db.from("transcripts").select("segments, provider").eq("submission_id", sub.id).maybeSingle();
  if (existing) {
    segments = (existing.segments as TranscriptSegment[]) ?? [];
    if (sub.kind === "video" && !audioMode) audioMode = segments.length ? "speech" : "music_no_speech";
  } else if (sub.kind === "video") {
    // A client WAV exists only when the browser decoded an audio track; otherwise fall back to the
    // original file unless the probe says there is no audio stream at all.
    const hasAudioFile = Boolean(sub.audio_path) || (probe?.has_audio !== false && Boolean(sub.file_path));
    const storeTranscript = (rows: TranscriptSegment[], provider: string) =>
      db.from("transcripts").upsert({ submission_id: sub.id, full_text: rows.map((r) => r.text).join(" "), segments: rows, language: "ar", provider });

    if (!shouldTranscribe(probe, hasAudioFile)) {
      // Case 1 (no audio stream) or a silent track: no API call.
      audioMode = probe?.has_audio === false || !hasAudioFile ? "no_audio" : "music_no_speech";
      await storeTranscript([], `skipped:${audioMode}`);
      log("transcription_skipped", { submission_id: sub.id, audio_mode: audioMode, probe: probe?.verdict ?? null });
    } else {
      const audioPath = (sub.audio_path ?? sub.file_path)!;
      try {
        const result = await timed("transcribe", async () => {
          const { data: blob, error } = await db.storage.from("media").download(audioPath);
          if (error || !blob) throw new ProviderError(`تعذّر تنزيل الملف الصوتي: ${error?.message ?? "missing"}`, true);
          if (blob.size > 25 * 1024 * 1024) throw new ProviderError("الملف الصوتي أكبر من 25 م.ب", false);
          return transcriptionProvider(env).transcribe(blob, audioPath.split("/").pop() ?? "audio.wav");
        });
        // Case 2/3: drop hallucinated or low-confidence segments (stricter if the probe suspected music).
        const filtered = filterSegments(result.scored, { strict: probe?.verdict === "no_speech_likely" });
        segments = filtered.kept.map(({ start, end, text }) => ({ start, end, text }));
        audioMode = decideAudioMode({ hasAudioStream: true, kept: filtered.kept });
        if (audioMode !== "speech") segments = [];
        asrSeconds = result.seconds;
        await storeTranscript(segments, `${result.provider}:${result.model}`);
        outputs.asr_dropped = filtered.dropped.slice(0, 20);
        outputs.asr_model = result.model;
        await saveRun({ asr_model: result.model, asr_provider: result.provider });
        log("transcription_filtered", { submission_id: sub.id, kept: filtered.kept.length, dropped: filtered.dropped.length, audio_mode: audioMode });
      } catch (e) {
        // The original file had no audio the provider could read (no client WAV) → treat as no audio.
        if (e instanceof ProviderError && e.info?.code === "bad_request" && !sub.audio_path) {
          audioMode = "no_audio";
          await storeTranscript([], "skipped:no_audio");
          log("transcription_no_audio_stream", { submission_id: sub.id, provider_type: e.info.type });
        } else throw e;
      }
    }
    outputs.asr_seconds = asrSeconds;
    outputs.audio_mode = audioMode;
    await saveRun({ audio_mode: audioMode, step_outputs: outputs });
  }
  (sub as SubmissionData).audio_mode = audioMode;
  await assertNotCancelled(db, sub.id);

  // ---- 2. Frames + vision/reasoning model -----------------------------------------------
  const [, { rules, frames, signed }] = await Promise.all([
    setProgress(db, sub.id, { status: "analyzing", current_step: "llm", progress: 40 }),
    prepared,
  ]);
  const validCodes = new Set(rules.map((r) => r.code));

  let llmFindings: Finding[] = [];
  let onScreen: OnScreenText[] = [];
  if (outputs.llm_done) {
    llmFindings = (outputs.llm_findings as Finding[]) ?? [];
    onScreen = (runRow?.on_screen_text as OnScreenText[]) ?? [];
  } else {
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
    const saved = saveRun({
      llm_model: analysis.model,
      llm_provider: analysis.provider,
      raw_llm_output: analysis.raw,
      token_usage: analysis.usage,
      on_screen_text: onScreen,
      frames_count: frameInputs.length,
      step_outputs: outputs,
    });
    // Store on-screen text on the nearest frame rows (for the report and audits).
    // On-screen text on the nearest frame rows (report + audits): all at once, alongside the run save.
    await timed("ocr_store", () =>
      Promise.all([
        saved,
        ...onScreen.map((o) => db.from("frames").update({ ocr_text: o.text }).eq("submission_id", sub.id).gte("t_seconds", o.t - 0.5).lte("t_seconds", o.t + 0.5)),
      ]),
    );
  }
  await assertNotCancelled(db, sub.id);

  // ---- 3. Deterministic checks ---------------------------------------------------------
  // Deterministic checks take ~1 ms, so there is no separate 85 % write.
  const det = await timed("deterministic", async () => runDeterministicChecks(sub, segments, onScreen, { audioMode }));

  // ---- 4. Merge + persist ----------------------------------------------------------------
  const merged = mergeAndFilterFindings([...det.findings, ...llmFindings], validCodes);
  if (merged.dropped.unknownRule.length) log("dropped_unknown_rules", { submission_id: sub.id, codes: merged.dropped.unknownRule });

  const [, { data: frameIndex }] = await timed("progress_95", () =>
    Promise.all([
      setProgress(db, sub.id, { current_step: "merge", progress: 95 }),
      db.from("frames").select("id, t_seconds").eq("submission_id", sub.id),
    ]),
  );
  const nearestFrame = (t: number | null | undefined) => {
    if (t == null || !frameIndex?.length) return null;
    return frameIndex.reduce((a, b) => (Math.abs(Number(b.t_seconds) - t) < Math.abs(Number(a.t_seconds) - t) ? b : a)).id;
  };

  const evidenceIds = [...new Set(merged.mergedFindings.map((f) => (f.evidence_type === "frame" ? nearestFrame(f.evidence_frame_t ?? f.t_start) : null)).filter((x): x is string => Boolean(x)))];
  // Blur runs alongside the findings writes; it finishes before "done" so thumbnails are never missing or unblurred.
  const blurred = timed("blur", () => blurEvidenceFrames(db, folder, evidenceIds));
  await timed("findings_delete", async () => await db.from("findings").delete().eq("run_id", runId));
  if (merged.mergedFindings.length) await timed("findings_insert", async () => {
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
  });

  const [, , usageRes] = await Promise.all([
    blurred,
    timed("compliance_log", async () => await db.from("compliance_logs").upsert({ submission_id: sub.id, content_hash: sub.sha256 ?? "", generated_at: new Date().toISOString() })),
    db.from("analysis_runs").select("token_usage, llm_model, asr_model").eq("id", runId).single(),
  ]);
  const usage = usageRes.data;
  const cost =
    textCost(usage?.llm_model ?? cfg.llmModel, (usage?.token_usage as never) ?? { input_tokens: 0, output_tokens: 0 }, env(`PRICE_${(usage?.llm_model ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`)) +
    audioCost(usage?.asr_model ?? cfg.transcriptionModel, asrSeconds);

  const tSave = Date.now();
  const doneRun = saveRun({
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
  await timed("set_done", () => setProgress(db, sub.id, {
    status: "done",
    progress: 100,
    current_step: "done",
    overall_status: merged.overallStatus,
    analyzed_at: new Date().toISOString(),
    error_message: null,
  }));
  await doneRun;
  durations.save_run = Date.now() - tSave;
  durations.total = Date.now() - pipelineStart;
  // After "done" (the report is already visible): seal the log and notify in parallel.
  await Promise.all([
    timed("seal", async () => await db.rpc("seal_compliance_log", { _sid: sub.id })),
    timed("notify", () => notifyUser(db, sub, true, merged.overallStatus)),
  ]);
  // Post-done timings (saveRun already happened) are appended so the tail is fully measured.
  await saveRun({ durations_ms: { ...(runRow?.durations_ms as object), ...durations } });
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
  // Independent lookups run together (each round trip is ~0.4 s).
  const [{ count }, { data: version }, latestRun] = await Promise.all([
    db.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    db.from("rulebook_versions").select("id, version_label").eq("is_active", true).limit(1).maybeSingle(),
    db.from("analysis_runs").select("id, status").eq("submission_id", sub.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if ((count ?? 0) > RATE_LIMIT_PER_HOUR) return json({ error: "rate_limited" }, 429);

  // --- Run row: reuse the latest unfinished run so steps resume.
  const cfg = config(env);
  let run = latestRun.data;
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
    const message = errorMessageFor(e);
    log("pipeline_failed", {
      submission_id: sub.id,
      error: (e as Error)?.message?.slice(0, 500),
      provider_status: e instanceof ProviderError ? (e.info?.status ?? e.status ?? null) : null,
      provider_code: e instanceof ProviderError ? (e.info?.code ?? null) : null,
      provider_type: e instanceof ProviderError ? (e.info?.type ?? null) : null,
      provider_request_id: e instanceof ProviderError ? (e.info?.requestId ?? null) : null,
    });
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
