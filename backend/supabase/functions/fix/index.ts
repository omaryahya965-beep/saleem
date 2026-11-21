// SALEEM Fix — الإصلاح الذكي (D178). POST { job_id, action: "estimate" | "generate" } with the caller's JWT.
// estimate: no model call — prompt size, estimated cost, quota and provider configuration.
// generate: ONE Gemini request (no automatic retry of a chargeable call), validated against invented licences,
// approvals, clinical evidence and endorsements, stored as a plan + proposal for the user to review. Nothing here
// creates a version or approves anything: the user accepts explicitly and the new version is analysed afresh.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { config, hasGeminiKey } from "../_shared/providers/index.ts";
import { TEXT_PRICES, textCost } from "../_shared/pipeline/cost.ts";
import {
  FIX_INSTRUCTIONS,
  FIX_SCHEMA,
  FixValidationError,
  buildFixPrompt,
  estimateFixCost,
  mediaProviders,
  validateFixOutput,
  type FixInput,
} from "../_shared/fix.ts";

const env = (k: string) => Deno.env.get(k);
const TIMEOUT_MS = 90_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const body = await req.json().catch(() => ({}));
  const jobId = typeof body.job_id === "string" ? body.job_id : null;
  const action = body.action === "generate" ? "generate" : "estimate";
  if (!jobId) return json({ error: "code:job_required" }, 400);

  // Reads as the caller (RLS); writes with the service role only after the checks below.
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const admin = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: me } = await db.auth.getUser(token);
  const { data: job } = await db.from("correction_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || !me.user || job.created_by !== me.user.id) return json({ error: "code:not_found" }, 404);

  const { data: check } = await db.rpc("can_fix_promotion", { _pid: job.promotion_id });
  const input = await loadInput(db, job);
  if (!input) return json({ error: "code:source_unavailable" }, 409);
  const prompt = buildFixPrompt(input);
  const model = config(env).llmModel;
  const price = TEXT_PRICES[model] ? { input: TEXT_PRICES[model]!.input, output: TEXT_PRICES[model]!.output } : null;
  const estimate = estimateFixCost(prompt, price);
  const configured = hasGeminiKey(env);

  if (action === "estimate") {
    return json({ estimate: { ...estimate, model }, quota: check, text_provider_configured: configured, media_providers: mediaProviders(env), status: job.status });
  }

  if (!configured) {
    await admin.from("correction_jobs").update({ status: "failed", error_code: "provider_not_configured", updated_at: new Date().toISOString() }).eq("id", jobId).in("status", ["draft", "failed"]);
    return json({ error: "code:provider_not_configured" }, 503);
  }
  if (!(check as { ok?: boolean } | null)?.ok) return json({ error: `code:${(check as { reasons?: string[] } | null)?.reasons?.[0] ?? "forbidden"}` }, 403);
  if (job.attempts >= 3) return json({ error: "code:too_many_attempts" }, 429);
  const { data: isDemo } = await admin.rpc("is_demo_sandbox_user", { _user: me.user.id });
  if (isDemo === true) {
    const { data: used } = await admin.rpc("demo_ai_runs_today");
    if (Number(used ?? 0) >= Number(env("DEMO_AI_DAILY_LIMIT") ?? 40)) return json({ error: "code:demo_quota" }, 429);
  }

  // Atomic claim: only a draft or failed job starts generating (duplicate clicks / tabs get 409).
  const { data: claimed } = await admin.from("correction_jobs")
    .update({ status: "generating", attempts: job.attempts + 1, error_code: null, provider: "gemini", model, estimated_cost_usd: estimate.usd, updated_at: new Date().toISOString() })
    .eq("id", jobId).in("status", ["draft", "failed"]).select("id").maybeSingle();
  if (!claimed) return json({ error: "code:job_in_progress" }, 409);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-goog-api-key": env("GEMINI_API_KEY")!.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: FIX_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: FIX_SCHEMA, temperature: 0.2 },
      }),
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      const code = res.status === 429 ? "quota" : res.status === 503 ? "overloaded" : "provider_error";
      throw new FixValidationError(code);
    }
    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const output = validateFixOutput(JSON.parse(text), input);
    const usage = {
      input_tokens: payload?.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: (payload?.usageMetadata?.candidatesTokenCount ?? 0) + (payload?.usageMetadata?.thoughtsTokenCount ?? 0),
      cached_input_tokens: payload?.usageMetadata?.cachedContentTokenCount ?? 0,
    };
    const cost = textCost(payload?.modelVersion ?? model, usage, env(`PRICE_${model.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`));
    await admin.from("correction_jobs").update({
      status: "ready", plan: output.plan, proposal: { caption: output.corrected_caption, script: output.corrected_script, disclosures: output.disclosures, changes: output.changes, limitations: output.limitations_ar },
      model: payload?.modelVersion ?? model, usage: { ...usage, cost_usd: cost }, updated_at: new Date().toISOString(),
    }).eq("id", jobId);
    return json({ status: "ready" });
  } catch (e) {
    const code = e instanceof FixValidationError ? e.code : e instanceof DOMException && e.name === "AbortError" ? "timeout" : e instanceof SyntaxError ? "schema" : "provider_error";
    log("fix_failed", { job: jobId, code });
    await admin.from("correction_jobs").update({ status: "failed", error_code: code, updated_at: new Date().toISOString() }).eq("id", jobId);
    return json({ error: `code:${code}` }, code === "quota" ? 429 : 502);
  }
});

// deno-lint-ignore no-explicit-any
async function loadInput(db: any, job: any): Promise<FixInput | null> {
  const sid = job.source_submission_id as string;
  const [{ data: sub }, { data: promo }, { data: run }, { data: tr }] = await Promise.all([
    db.from("submissions").select("id, title, caption, text_content, kind").eq("id", sid).maybeSingle(),
    db.from("promotions").select("id, title, caption, product_id").eq("id", job.promotion_id).maybeSingle(),
    db.from("analysis_runs").select("id, on_screen_text").eq("submission_id", sid).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("transcripts").select("segments").eq("submission_id", sid).maybeSingle(),
  ]);
  if (!sub || !promo || !run) return null;
  const ids: string[] = job.selected_finding_ids ?? [];
  let fq = db.from("findings").select("id, rule_code, severity, finding_type, evidence_type, evidence_text, t_start, explanation_ar, fix_ar").eq("run_id", run.id);
  if (ids.length) fq = fq.in("id", ids);
  const [{ data: findings }, { data: product }, { data: responses }, { data: decisions }] = await Promise.all([
    fq,
    promo.product_id ? db.from("products").select("name_ar, sector, product_type").eq("id", promo.product_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("finding_responses").select("finding_id, comment, actor_role").eq("submission_id", sid).eq("actor_role", "reviewer"),
    db.from("review_decisions").select("comment, decision").eq("promotion_id", job.promotion_id).order("created_at", { ascending: false }).limit(3),
  ]);
  const notes = new Map<string, string>();
  for (const r of responses ?? []) if (r.comment) notes.set(r.finding_id, r.comment);
  return {
    title: promo.title ?? sub.title ?? "",
    caption: sub.caption || promo.caption || (sub.kind === "text" ? sub.text_content ?? "" : ""),
    transcript: ((tr?.segments as { start: number; end: number; text: string }[]) ?? []).slice(0, 200),
    onScreen: ((run.on_screen_text as { t: number; text: string }[]) ?? []).slice(0, 100),
    product: product ?? null,
    findings: (findings ?? []).map((f: Record<string, unknown>) => ({ ...f, t_start: f.t_start == null ? null : Number(f.t_start), reviewer_note: notes.get(f.id as string) ?? null })),
    preferences: job.preferences ?? {},
    instructions: job.instructions,
    reviewerFeedback: (decisions ?? []).map((d: { comment: string | null }) => d.comment).filter(Boolean),
  } as FixInput;
}
