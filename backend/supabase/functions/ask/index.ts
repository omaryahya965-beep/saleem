// SALEEM ask (Phase 7.4) — read-only assistant. POST { org_id, question, lang } with the caller's JWT.
// Every read uses the caller's own client (RLS applies); nothing is written. Answers cite links to rules,
// promotions and findings the caller can open. The configured model only phrases the answer from those sources;
// without a model key the sources are listed as they are.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
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
  const orgId = typeof body.org_id === "string" ? body.org_id : null;
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  const lang: "ar" | "en" = body.lang === "en" ? "en" : "ar";
  if (!orgId || question.length < 3) return json({ error: "code:question_required" }, 400);

  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: on } = await db.rpc("org_feature", { _org: orgId, _key: "ask_saleem" });
  const { data: member } = await db.from("org_members").select("user_id").eq("org_id", orgId).limit(1);
  if (on !== true || !member?.length) return json({ error: "code:feature_off" }, 403);

  const ts = terms(question);
  const sources: AskSource[] = [];
  if (ts.length) {
    const [rules, promos, findings] = await Promise.all([
      db.from("rules").select("id, code, title_ar, title_en, summary_ar, review_state").eq("is_active", true).or(orFilter(["code", "title_ar", "title_en", "summary_ar"], ts)).limit(5),
      db.from("promotions").select("id, title, review_status").eq("org_id", orgId).or(orFilter(["title"], ts)).limit(5),
      db.from("findings").select("id, rule_code, explanation_ar, explanation_en, submission_id, submissions(promotion_id)").or(orFilter(["rule_code", "explanation_ar"], ts)).limit(5),
    ]);
    for (const r of rules.data ?? []) {
      sources.push({ kind: "rule", id: r.id, title: `${r.code} · ${lang === "en" ? r.title_en : r.title_ar}`, detail: `${r.review_state}${r.summary_ar ? ` — ${String(r.summary_ar).slice(0, 200)}` : ""}`, link: `/rules?q=${encodeURIComponent(r.code)}` });
    }
    for (const p of promos.data ?? []) sources.push({ kind: "promotion", id: p.id, title: p.title, detail: p.review_status, link: `/promotions/${p.id}` });
    for (const f of findings.data ?? []) {
      const pid = (f.submissions as unknown as { promotion_id: string | null } | null)?.promotion_id;
      if (!pid) continue;
      sources.push({ kind: "finding", id: f.id, title: f.rule_code, detail: String((lang === "en" ? f.explanation_en : f.explanation_ar) ?? "").slice(0, 200), link: `/promotions/${pid}` });
    }
  }

  let answer = plainAnswer(sources, lang);
  let model = false;
  const c = config(env);
  const geminiKey = env("GEMINI_API_KEY")?.trim();
  if (sources.length && geminiKey && hasGeminiKey(env)) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.llmModel)}:generateContent`;
      const promptText = `${ASK_INSTRUCTIONS}\n\nQuestion: ${question}\n\nSources:\n${sources.map((s, i) => `[${i + 1}] (${s.kind}) ${s.title} — ${s.detail}`).join("\n")}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": geminiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: { maxOutputTokens: 800 },
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
  return json({ answer, sources, model });
});
