// SALEEM AI Studio (D207). POST { draft_id, action: "estimate" | "script" | "scene" | "review", provider?, scene_index?, note? }
// with the caller's JWT. The provider is always chosen explicitly by the user:
//   - "template": deterministic script from the brief, no AI request, no quota;
//   - "gemini":   ONE structured request (no automatic retry), quota-checked per organisation and capability, validated
//                 against invented claims; usage recorded in ai_usage.
// "review" runs the deterministic claims engine on the script (no AI request). Nothing here creates an advertisement.
import { serviceClient, userClient } from "../_shared/clients.ts";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { config, hasGeminiKey } from "../_shared/providers/index.ts";
import { TEXT_PRICES, textCost } from "../_shared/pipeline/cost.ts";
import {
  STUDIO_INSTRUCTIONS,
  STUDIO_SCHEMA,
  StudioError,
  buildStudioPrompt,
  estimateScriptCost,
  normalizeBrief,
  reviewScript,
  templateScript,
  validateScript,
  type StudioScript,
} from "../_shared/studio.ts";

const env = (k: string) => Deno.env.get(k);
const TIMEOUT_MS = 60_000;
const OPEN = ["brief", "script_ready", "reviewed", "rendered", "failed"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const body = await req.json().catch(() => ({}));
  const draftId = typeof body.draft_id === "string" ? body.draft_id : null;
  const action = ["estimate", "script", "scene", "review"].includes(body.action) ? body.action : "estimate";
  const provider = body.provider === "gemini" ? "gemini" : "template";
  if (!draftId) return json({ error: "code:draft_required" }, 400);

  const db = userClient(token);
  const admin = serviceClient();
  const { data: me } = await db.auth.getUser(token);
  const { data: draft } = await db.from("studio_drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft || !me.user || draft.created_by !== me.user.id) return json({ error: "code:not_found" }, 404);
  if (!OPEN.includes(draft.status)) return json({ error: "code:invalid_status" }, 409);
  const { data: allowed } = await db.rpc("can_use_studio", { _org: draft.org_id });
  if (allowed !== true) return json({ error: "code:forbidden" }, 403);

  const brief = normalizeBrief(draft.brief);
  const model = config(env).llmModel;
  const price = TEXT_PRICES[model] ? { input: TEXT_PRICES[model]!.input, output: TEXT_PRICES[model]!.output } : null;
  const now = () => new Date().toISOString();

  if (action === "estimate") {
    const { data: allowance } = await db.rpc("ai_allowance", { _org: draft.org_id, _capability: "script" });
    return json({
      providers: { template: { configured: true }, gemini: { configured: hasGeminiKey(env), model } },
      estimate: { ...estimateScriptCost(buildStudioPrompt(brief), price), model },
      allowance,
    });
  }

  if (action === "review") {
    if (!draft.script) return json({ error: "code:no_script" }, 409);
    let script: StudioScript;
    try {
      script = validateScript(draft.script, brief);
    } catch (e) {
      // A fabricated statement typed by the user is reported by the review rather than rejected.
      if (!(e instanceof StudioError) || !e.code.startsWith("fabricated_")) return json({ error: `code:${(e as StudioError).code ?? "schema"}` }, 422);
      script = draft.script as StudioScript;
    }
    const items = reviewScript(script, brief);
    const review = { items, checked_at: now(), engine: "deterministic" };
    await admin.from("studio_drafts").update({ review, status: "reviewed", updated_at: now() }).eq("id", draftId).in("status", OPEN);
    return json({ review });
  }

  // script | scene
  const sceneIndex = action === "scene" ? Number(body.scene_index) : null;
  const current = draft.script as StudioScript | null;
  if (action === "scene" && (!current || !Number.isInteger(sceneIndex) || sceneIndex! < 0 || sceneIndex! >= current.scenes.length))
    return json({ error: "code:invalid_scene" }, 400);

  if (provider === "template") {
    const fresh = templateScript(brief);
    const script =
      action === "scene" && current
        ? { ...current, scenes: current.scenes.map((s, i) => (i === sceneIndex ? { ...(fresh.scenes[Math.min(i, fresh.scenes.length - 1)] ?? s), index: i, start: s.start, duration: s.duration } : s)) }
        : fresh;
    await admin.from("studio_drafts").update({ script, review: null, status: "script_ready", script_provider: current && action === "scene" ? draft.script_provider ?? "template" : "template", error_code: null, updated_at: now() }).eq("id", draftId).in("status", OPEN);
    return json({ script, provider: "template" });
  }

  // Gemini: configured, allowed, within quota and demo cap, claimed atomically.
  if (!hasGeminiKey(env)) return json({ error: "code:provider_not_configured" }, 503);
  const { data: allowance } = await db.rpc("ai_allowance", { _org: draft.org_id, _capability: "script" });
  if (!(allowance as { ok?: boolean } | null)?.ok) return json({ error: "code:quota_exhausted", allowance }, 429);
  const { data: isDemo } = await admin.rpc("is_demo_sandbox_user", { _user: me.user.id });
  if (isDemo === true) {
    const { data: used } = await admin.rpc("demo_ai_runs_today");
    if (Number(used ?? 0) >= Number(env("DEMO_AI_DAILY_LIMIT") ?? 40)) return json({ error: "code:demo_quota" }, 429);
  }
  if (draft.attempts >= 20) return json({ error: "code:too_many_attempts" }, 429);
  const previous = draft.status;
  const { data: claimed } = await admin.from("studio_drafts")
    .update({ status: "generating", attempts: draft.attempts + 1, error_code: null, updated_at: now() })
    .eq("id", draftId).in("status", OPEN).select("id").maybeSingle();
  if (!claimed) return json({ error: "code:job_in_progress" }, 409);

  const prompt = buildStudioPrompt(brief, action === "scene" && current ? { index: sceneIndex!, current, note: String(body.note ?? "") } : undefined);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      headers: { "x-goog-api-key": env("GEMINI_API_KEY")!.trim(), "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: STUDIO_INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: STUDIO_SCHEMA, temperature: 0.6 },
      }),
    }).finally(() => clearTimeout(timer));
    if (!res.ok) throw new StudioError(res.status === 429 ? "provider_quota" : res.status === 503 ? "overloaded" : "provider_error");
    const payload = await res.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    let script = validateScript(JSON.parse(text), brief);
    if (action === "scene" && current) {
      const replacement = script.scenes[sceneIndex!] ?? script.scenes[0]!;
      script = { ...current, scenes: current.scenes.map((s, i) => (i === sceneIndex ? { ...replacement, index: i, start: s.start, duration: s.duration } : s)) };
    }
    const usage = {
      input_tokens: payload?.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: (payload?.usageMetadata?.candidatesTokenCount ?? 0) + (payload?.usageMetadata?.thoughtsTokenCount ?? 0),
      cached_input_tokens: payload?.usageMetadata?.cachedContentTokenCount ?? 0,
    };
    const cost = textCost(payload?.modelVersion ?? model, usage, env(`PRICE_${model.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`));
    await admin.from("ai_usage").insert({ org_id: draft.org_id, user_id: me.user.id, capability: "script", provider: "gemini", model: payload?.modelVersion ?? model, units: 1, est_cost_usd: cost, ref_id: draftId });
    await admin.from("studio_drafts").update({ script, review: null, status: "script_ready", script_provider: "gemini", updated_at: now() }).eq("id", draftId);
    return json({ script, provider: "gemini", usage: { ...usage, cost_usd: cost } });
  } catch (e) {
    const code = e instanceof StudioError ? e.code : e instanceof DOMException && e.name === "AbortError" ? "timeout" : e instanceof SyntaxError ? "schema" : "provider_error";
    log("studio_failed", { draft: draftId, code });
    await admin.from("studio_drafts").update({ status: previous === "brief" ? "failed" : previous, error_code: code, updated_at: now() }).eq("id", draftId);
    return json({ error: `code:${code}` }, code === "provider_quota" ? 429 : 502);
  }
});
