// supabase/functions/analyze/index.ts
// SALEEM Analysis Pipeline Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import type { Finding, RuleRecord, SubmissionData, TranscriptSegment } from "../_shared/types.ts";
import { runDeterministicChecks } from "../_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../_shared/pipeline/merge.ts";
import { transcribeAudio } from "../_shared/providers/transcription.ts";
import { runLlmChecks } from "../_shared/providers/llm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const submissionId = body.submission_id;

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: submission_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Analyze] Starting analysis for submission: ${submissionId}`);

    // 1. Fetch submission data
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (subError || !submission) {
      return new Response(
        JSON.stringify({ error: `Submission not found: ${subError?.message || ""}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If demo submission, mark done immediately
    if (submission.is_demo) {
      return new Response(
        JSON.stringify({ status: "done", message: "Demo submission already analyzed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch AI settings
    const { data: aiSettings } = await supabase
      .from("ai_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const llmModel = Deno.env.get("LLM_MODEL") || aiSettings?.llm_model || "claude-3-5-sonnet-20241022";
    const asrModel = Deno.env.get("ASR_MODEL") || aiSettings?.asr_model || "whisper-1";

    // 3. Create or fetch analysis run
    let { data: run } = await supabase
      .from("analysis_runs")
      .select("*")
      .eq("submission_id", submissionId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!run) {
      const { data: newRun, error: runError } = await supabase
        .from("analysis_runs")
        .insert({
          submission_id: submissionId,
          rulebook_version: "2026.10-a",
          llm_model: llmModel,
          asr_model: asrModel,
          prompt_version: "v1",
        })
        .select()
        .single();

      if (runError) throw runError;
      run = newRun;
    }

    // Update status to analyzing
    await supabase
      .from("submissions")
      .update({ status: "analyzing", progress: 15, current_step: "transcribe" })
      .eq("id", submissionId);

    // =========================================================================
    // STEP 1: Transcription
    // =========================================================================
    let segments: TranscriptSegment[] = [];
    let fullTranscriptText = "";

    const { data: existingTranscript } = await supabase
      .from("transcripts")
      .select("*")
      .eq("submission_id", submissionId)
      .maybeSingle();

    if (existingTranscript) {
      fullTranscriptText = existingTranscript.full_text || "";
      segments = (existingTranscript.segments as TranscriptSegment[]) || [];
    } else {
      let audioBuffer: ArrayBuffer | null = null;

      // Try fetching audio file from storage if present
      const audioPath = submission.audio_path || submission.file_path;
      if (audioPath) {
        const { data: fileData } = await supabase.storage.from("media").download(audioPath);
        if (fileData) {
          audioBuffer = await fileData.arrayBuffer();
        }
      }

      const transcription = await transcribeAudio(audioBuffer, "media.mp4", asrModel);
      fullTranscriptText = transcription.full_text;
      segments = transcription.segments;

      await supabase.from("transcripts").upsert({
        submission_id: submissionId,
        full_text: fullTranscriptText,
        segments: segments,
        language: "ar",
        provider: transcription.provider,
      });
    }

    await supabase
      .from("submissions")
      .update({ progress: 40, current_step: "deterministic" })
      .eq("id", submissionId);

    // =========================================================================
    // STEP 2: Deterministic Compliance Checks
    // =========================================================================
    const deterministicFindings = runDeterministicChecks(submission as SubmissionData, segments);

    await supabase
      .from("submissions")
      .update({ progress: 65, current_step: "llm" })
      .eq("id", submissionId);

    // =========================================================================
    // STEP 3: LLM Content & Visual Checks
    // =========================================================================
    const { data: rules } = await supabase
      .from("rules")
      .select("*")
      .eq("is_active", true);

    const activeRules = (rules || []) as RuleRecord[];
    const validRuleCodes = new Set(activeRules.map((r) => r.code));

    // Fetch extracted frames from frames table
    const { data: frameRecords } = await supabase
      .from("frames")
      .select("*")
      .eq("submission_id", submissionId)
      .limit(12);

    const frames = (frameRecords || []).map((f) => ({
      t_seconds: Number(f.t_seconds),
      image_path: f.image_path || undefined,
    }));

    const llmFindings = await runLlmChecks(
      submission as SubmissionData,
      segments,
      activeRules,
      frames,
      llmModel
    );

    await supabase
      .from("submissions")
      .update({ progress: 85, current_step: "merge" })
      .eq("id", submissionId);

    // =========================================================================
    // STEP 4: Merge, Calibrate & Persist Findings
    // =========================================================================
    const allFindings = [...deterministicFindings, ...llmFindings];
    const { mergedFindings, overallStatus } = mergeAndFilterFindings(allFindings, validRuleCodes);

    // Clean old findings for this run if any
    await supabase.from("findings").delete().eq("run_id", run.id);

    // Insert merged findings
    if (mergedFindings.length > 0) {
      const findingsToInsert = mergedFindings.map((f: Finding) => ({
        run_id: run.id,
        submission_id: submissionId,
        rule_code: f.rule_code,
        severity: f.severity,
        t_start: f.t_start,
        t_end: f.t_end,
        evidence_type: f.evidence_type,
        evidence_text: f.evidence_text,
        explanation_ar: f.explanation_ar,
        explanation_en: f.explanation_en || null,
        fix_ar: f.fix_ar,
        fix_en: f.fix_en || null,
        confidence: f.confidence,
        source: f.source,
      }));

      const { error: insertFindingsError } = await supabase
        .from("findings")
        .insert(findingsToInsert);

      if (insertFindingsError) console.error("[Analyze] Error inserting findings:", insertFindingsError);
    }

    // Create or update compliance log
    const contentHash = submission.sha256 || `hash-${submissionId.slice(0, 16)}`;
    await supabase.from("compliance_logs").upsert({
      submission_id: submissionId,
      content_hash: contentHash,
    });

    // Update analysis run record
    await supabase
      .from("analysis_runs")
      .update({
        finished_at: new Date().toISOString(),
        step_outputs: {
          deterministic_count: deterministicFindings.length,
          llm_count: llmFindings.length,
          merged_count: mergedFindings.length,
        },
      })
      .eq("id", run.id);

    // Finalize submission
    await supabase
      .from("submissions")
      .update({
        status: "done",
        progress: 100,
        current_step: "done",
        overall_status: overallStatus,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    console.log(`[Analyze] Completed analysis for ${submissionId}: status = ${overallStatus}`);

    return new Response(
      JSON.stringify({
        status: "done",
        submission_id: submissionId,
        overall_status: overallStatus,
        findings_count: mergedFindings.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Analyze] Fatal error in analysis pipeline:", message);

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
