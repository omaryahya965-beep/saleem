// SALEEM internal-rules-draft (Phase 6.7) — drafts internal-policy rules from a brand guideline.
// POST { org_id, guideline_id } with the caller's JWT. The caller must be an owner/admin with
// features.internal_rules on. Uses the configured model (same provider and model as analysis) when an API key is
// set; otherwise one draft per directive sentence, marked heuristic_draft. Every draft starts as status 'draft'
// and must be edited and approved by a person before it runs. Never drafts regulatory rules.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { config, hasGeminiKey } from "../_shared/providers/index.ts";
import { cleanDrafts, DRAFT_SCHEMA, heuristicDrafts, type DraftRule } from "../_shared/rules/internal.ts";

const env = (k: string) => Deno.env.get(k);

const INSTRUCTIONS = `You turn a company's brand guideline into internal checks for marketing reviewers.
Return at most 15 rules. Each rule: code "INT-" + 2–24 capital letters/digits/hyphens, a short Arabic title and one
Arabic sentence saying what to check in an ad (logo, colours, fonts, tone, wording). Only use what the guideline says.
These are internal company policy, not regulation: never cite or invent laws, regulators or articles.`;

async function draftWithGemini(apiKey: string, model: string, text: string): Promise<DraftRule[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${INSTRUCTIONS}\n\nBrand guideline text:\n${text.slice(0, 40_000)}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: DRAFT_SCHEMA,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingLevel: Deno.env.get("GEMINI_THINKING_LEVEL")?.trim().toUpperCase() || "LOW" },
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`code:model_failed:${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const candidate = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought)?.map((p) => p.text ?? "")?.join("") ?? "";
  return cleanDrafts(JSON.parse(candidate || "{}"));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const body = await req.json().catch(() => ({}));
  const orgId = typeof body.org_id === "string" ? body.org_id : null;
  const guidelineId = typeof body.guideline_id === "string" ? body.guideline_id : null;
  if (!orgId || !guidelineId) return json({ error: "org_id and guideline_id are required" }, 400);

  const asUser = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: allowed } = await asUser.rpc("can_manage_internal_rules", { _org: orgId });
  if (allowed !== true) return json({ error: "code:forbidden" }, 403);
  const { data: guideline } = await asUser.from("brand_guidelines").select("id, text_ar").eq("id", guidelineId).eq("org_id", orgId).maybeSingle();
  if (!guideline) return json({ error: "code:not_found" }, 404);

  const c = config(env);
  const geminiKey = env("GEMINI_API_KEY")?.trim();
  let drafts: DraftRule[];
  let source: "model_draft" | "heuristic_draft";
  try {
    if (geminiKey && hasGeminiKey(env)) {
      drafts = await draftWithGemini(geminiKey, c.llmModel, guideline.text_ar as string);
      source = "model_draft";
    } else {
      drafts = heuristicDrafts(guideline.text_ar as string);
      source = "heuristic_draft";
    }
  } catch (e) {
    log("internal_rules_draft_failed", { org_id: orgId, error: String(e).slice(0, 200) });
    drafts = heuristicDrafts(guideline.text_ar as string);
    source = "heuristic_draft";
  }

  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: existing } = await db.from("internal_rules").select("code").eq("org_id", orgId);
  const taken = new Set((existing ?? []).map((r) => r.code as string));
  const rows = drafts
    .map((d) => {
      let code = d.code;
      for (let i = 2; taken.has(code); i++) code = `${d.code.slice(0, 21)}-${i}`;
      taken.add(code);
      return { org_id: orgId, code, title_ar: d.title_ar, instruction_ar: d.instruction_ar, source, guideline_id: guidelineId, status: "draft" };
    });
  if (rows.length) {
    const { error } = await db.from("internal_rules").insert(rows);
    if (error) return json({ error: "code:insert_failed" }, 500);
  }
  log("internal_rules_drafted", { org_id: orgId, count: rows.length, source });
  return json({ drafted: rows.length, source });
});
