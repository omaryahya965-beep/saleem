// SALEEM diagnostics — admin-only health check of the Gemini configuration.
// POST with an admin user's JWT. Returns ONLY non-secret facts: whether GEMINI_API_KEY is set, the
// configured model, the HTTP status + classified error code of a models.get probe, and usage totals.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { classifyProviderError } from "../_shared/providers/errors.ts";
import { config, hasGeminiKey } from "../_shared/providers/index.ts";

const env = (k: string) => Deno.env.get(k);

async function probe(model: string, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`;
  const res = await fetch(url, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10_000) });
  const body = await res.text();
  if (res.ok) return { status: res.status, error_type: null, error_code: null, request_id: res.headers.get("x-request-id") };
  const info = classifyProviderError(res.status, body, res.headers.get("x-request-id"));
  return { status: res.status, error_type: info.type, error_code: info.code, request_id: info.requestId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = token ? await db.auth.getUser(token) : { data: null };
  if (!auth?.user) return json({ error: "invalid session" }, 401);
  const [{ data: platformAdmin }, { data: orgAdmin }] = await Promise.all([
    db.from("user_roles").select("role").eq("user_id", auth.user.id).eq("role", "admin").maybeSingle(),
    db.from("org_members").select("role").eq("user_id", auth.user.id).in("role", ["owner", "admin"]).limit(1),
  ]);
  if (!platformAdmin && (!orgAdmin || !orgAdmin.length)) return json({ error: "forbidden" }, 403);

  const cfg = config(env);
  const key = env("GEMINI_API_KEY")?.trim() ?? "";
  const isPlaceholder = !hasGeminiKey(env);

  // Aggregate real usage metrics from analysis_runs table
  const { data: runs } = await db
    .from("analysis_runs")
    .select("status, cost_usd, token_usage, llm_provider, llm_model");
  
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let successfulRuns = 0;
  let failedRuns = 0;
  const totalRuns = (runs ?? []).length;

  for (const r of runs ?? []) {
    if (r.status === "done") successfulRuns++;
    else if (r.status === "failed") failedRuns++;
    if (r.cost_usd) totalCostUsd += Number(r.cost_usd);
    const usage = r.token_usage as { input_tokens?: number; output_tokens?: number } | null;
    if (usage?.input_tokens) totalInputTokens += usage.input_tokens;
    if (usage?.output_tokens) totalOutputTokens += usage.output_tokens;
  }

  const out: Record<string, unknown> = {
    provider: cfg.llmProvider,
    model: cfg.llmModel,
    transcription_provider: cfg.transcriptionProvider,
    transcription_model: cfg.transcriptionModel,
    key_configured: Boolean(key && !isPlaceholder),
    status: isPlaceholder ? "missing_key" : "configured",
    usage: {
      total_runs: totalRuns,
      successful_runs: successfulRuns,
      failed_runs: failedRuns,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
      total_cost_usd: Number(totalCostUsd.toFixed(4)),
    },
  };

  if (isPlaceholder) {
    return json(out);
  }

  // Real connection test: probe model availability
  try {
    const probeRes = await probe(cfg.llmModel, key);
    out.connection_test = probeRes;
    if (probeRes.status === 200) {
      out.status = "verified";
    } else if (probeRes.error_code) {
      out.status = probeRes.error_code;
    } else {
      out.status = "error";
    }
  } catch {
    out.status = "provider_down";
    out.connection_test = { status: 503, error_code: "provider_down" };
  }

  log("diagnostics_run", { by: auth.user.id, provider: cfg.llmProvider, status: out.status });
  return json(out);
});
