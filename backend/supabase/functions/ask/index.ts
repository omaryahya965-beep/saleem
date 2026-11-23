// SALEEM ask (Phase 7.4) — read-only assistant. POST { org_id?, question, lang } with the caller's JWT.
// Every read uses the caller's own client (RLS applies); nothing is written except usage metering. Answers cite links
// to rules, promotions and findings the caller can open. The configured model only phrases the answer from those
// sources; without a model key (or without allowance) the sources are listed as they are.
//
// Organisation mode (org_id): unchanged — the organisation's ask_saleem feature and membership are required.
// Personal mode (no org_id, D211): the caller's personal workspace is required; sources are VERIFIED ACTIVE rules only
// (never drafts, never any organisation's internal policies) and the caller's own personal advertisements. A model
// answer counts against the personal «ask» allowance and, for demo users, the shared demo AI cap.
import { serviceClient, userClient } from "../_shared/clients.ts";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { config, hasGeminiKey } from "../_shared/providers/index.ts";
import { ASK_INSTRUCTIONS, orFilter, plainAnswer, terms, type AskSource } from "../_shared/ask.ts";

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const body = await req.json().catch(() => ({}));
  const orgId = typeof body.org_id === "string" && body.org_id ? body.org_id : null;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const lang: "ar" | "en" = body.lang === "en" ? "en" : "ar";
  if (question.length < 3) return json({ error: "code:question_required" }, 400);

  const db = userClient(token);
  const { data: me } = await db.auth.getUser(token);
  if (!me?.user) return json({ error: "missing authorization" }, 401);

  if (orgId) {
    const { data: on } = await db.rpc("org_feature", { _org: orgId, _key: "ask_saleem" });
    const { data: member } = await db.from("org_members").select("user_id").eq("org_id", orgId).limit(1);
    if (on !== true || !member?.length) return json({ error: "code:feature_off" }, 403);
  } else {
    const { data: ws } = await db.from("personal_workspaces").select("user_id").eq("user_id", me.user.id).maybeSingle();
    if (!ws) return json({ error: "code:no_personal_workspace" }, 403);
  }

  const ts = terms(question);
  const sources: AskSource[] = [];
  if (ts.length) {
    let rulesQ = db.from("rules").select("id, code, title_ar, title_en, summary_ar, review_state, pack").eq("is_active", true)
      .or(orFilter(["code", "title_ar", "title_en", "summary_ar"], ts)).limit(5);
    if (!orgId) rulesQ = rulesQ.eq("review_state", "active");
    const promosQ = orgId
      ? db.from("promotions").select("id, title, review_status").eq("org_id", orgId).or(orFilter(["title"], ts)).limit(5)
      : db.from("promotions").select("id, title, review_status").is("org_id", null).eq("owner_id", me.user.id).or(orFilter(["title"], ts)).limit(5);
    const findingsQ = orgId
      ? db.from("findings").select("id, rule_code, explanation_ar, explanation_en, submission_id, submissions(promotion_id)").or(orFilter(["rule_code", "explanation_ar"], ts)).limit(5)
      : db.from("findings").select("id, rule_code, explanation_ar, explanation_en, submission_id, submissions!inner(promotion_id, user_id, org_id)")
          .eq("submissions.user_id", me.user.id).is("submissions.org_id", null).or(orFilter(["rule_code", "explanation_ar"], ts)).limit(5);
    const [rules, promos, findings] = await Promise.all([rulesQ, promosQ, findingsQ]);
    for (const r of rules.data ?? []) {
      sources.push({ kind: "rule", id: r.id, title: `${r.code} · ${lang === "en" ? r.title_en : r.title_ar}`, detail: `${r.review_state}${r.summary_ar ? ` — ${String(r.summary_ar).slice(0, 200)}` : ""}`, link: `/rules?q=${encodeURIComponent(r.code)}` });
    }
    for (const p of promos.data ?? []) sources.push({ kind: "promotion", id: p.id, title: p.title, detail: orgId ? p.review_status : "", link: `/promotions/${p.id}` });
    for (const f of findings.data ?? []) {
      const pid = (f.submissions as unknown as { promotion_id: string | null } | null)?.promotion_id;
      if (!pid) continue;
      sources.push({ kind: "finding", id: f.id, title: f.rule_code, detail: String((lang === "en" ? f.explanation_en : f.explanation_ar) ?? "").slice(0, 200), link: `/promotions/${pid}` });
    }
  }

  let answer = plainAnswer(sources, lang);
  let model = false;
  let limited: string | null = null;
  const c = config(env);
  const geminiKey = env("GEMINI_API_KEY")?.trim();
  if (sources.length && geminiKey && hasGeminiKey(env)) {
    // Personal answers are metered (monthly «ask» allowance; demo users also share the daily demo cap).
    const admin = orgId ? null : serviceClient();
    if (admin) {
      const { data: allowance } = await db.rpc("ai_allowance", { _org: null, _capability: "ask" });
      if ((allowance as { ok?: boolean } | null)?.ok === false) limited = "quota_exceeded";
      const { data: isDemo } = await admin.rpc("is_demo_sandbox_user", { _user: me.user.id });
      if (!limited && isDemo === true) {
        const { data: used } = await admin.rpc("demo_ai_runs_today");
        if (Number(used ?? 0) >= Number(env("DEMO_AI_DAILY_LIMIT") ?? 40)) limited = "demo_quota";
      }
    }
    if (!limited) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.llmModel)}:generateContent`;
        const promptText = `${ASK_INSTRUCTIONS}\n\nQuestion: ${question}\n\nSources:\n${sources.map((s, i) => `[${i + 1}] (${s.kind}) ${s.title} — ${s.detail}`).join("\n")}`;
        if (admin) await admin.from("ai_usage").insert({ org_id: null, user_id: me.user.id, capability: "ask", provider: "gemini", model: c.llmModel });
        const res = await fetch(url, {
          method: "POST",
          headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { maxOutputTokens: 800, thinkingConfig: { thinkingLevel: env("GEMINI_THINKING_LEVEL")?.trim().toUpperCase() || "LOW" } },
          }),
          signal: AbortSignal.timeout(45_000),
        });
        if (res.ok) {
          const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
          const text = d.candidates?.[0]?.content?.parts?.filter((p) => !p.thought)?.map((p) => p.text ?? "")?.join("");
          if (text) { answer = text; model = true; }
        }
      } catch (e) {
        log("ask_model_failed", { error: String(e).slice(0, 200) });
      }
    }
  }
  return json({ answer, sources, model, limited, scope: orgId ? "organization" : "personal" });
});
