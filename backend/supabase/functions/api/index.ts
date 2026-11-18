// SALEEM public API v1 (Phase 7.2) — read-only in this release.
// Auth: `Authorization: Bearer slm_…` (an org API key: hashed, scoped, expiring, revocable, 60 requests/minute).
//   GET /api/v1/promotions[?status=…]          scope promotions:read
//   GET /api/v1/promotions/{id}                scope promotions:read
//   GET /api/v1/versions/{id}/findings         scope findings:read   (latest analysis run)
//   GET /api/v1/promotions/{id}/decisions      scope decisions:read  (sealed decisions with hashes)
// Every query is limited to the key's organisation. Write endpoints are not available yet (D133).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders, json, log } from "../_shared/http.ts";

const env = (k: string) => Deno.env.get(k);
const UUID = "[0-9a-f-]{36}";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "code:not_supported" }, 405);
  const key = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!key.startsWith("slm_")) return json({ error: "code:invalid_key" }, 401);
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: check } = await db.rpc("api_key_check", { _key: key, _limit: 60 });
  const k = (check ?? {}) as { ok?: boolean; reason?: string; org_id?: string; scopes?: string[]; key_id?: string };
  if (!k.ok) return json({ error: `code:${k.reason ?? "invalid_key"}` }, k.reason === "rate_limited" ? 429 : 401);
  const org = k.org_id!;
  const need = (s: string) => (k.scopes ?? []).includes(s);
  const path = new URL(req.url).pathname.replace(/^.*\/api(?=\/v1\/)/, "").replace(/\/+$/, "");
  log("api_request", { key_id: k.key_id, path });

  let m: RegExpMatchArray | null;
  if (path === "/v1/promotions") {
    if (!need("promotions:read")) return json({ error: "code:scope" }, 403);
    let q = db.from("promotions").select("id, title, review_status, communication_type, channels, market, deadline_at, submitted_at, approved_at, updated_at, current_version_id")
      .eq("org_id", org).eq("is_demo", false).order("updated_at", { ascending: false }).limit(200);
    const status = new URL(req.url).searchParams.get("status");
    if (status) q = q.eq("review_status", status);
    const { data, error } = await q;
    return error ? json({ error: "code:lookup_failed" }, 500) : json({ data });
  }
  if ((m = path.match(new RegExp(`^/v1/promotions/(${UUID})$`)))) {
    if (!need("promotions:read")) return json({ error: "code:scope" }, 403);
    const { data } = await db.from("promotions").select("id, title, review_status, communication_type, channels, market, product_id, deadline_at, submitted_at, approved_at, approved_version_id, current_version_id, updated_at")
      .eq("org_id", org).eq("id", m[1]).maybeSingle();
    return data ? json({ data }) : json({ error: "code:not_found" }, 404);
  }
  if ((m = path.match(new RegExp(`^/v1/versions/(${UUID})/findings$`)))) {
    if (!need("findings:read")) return json({ error: "code:scope" }, 403);
    const { data: sub } = await db.from("submissions").select("id, status, overall_status").eq("org_id", org).eq("id", m[1]).maybeSingle();
    if (!sub) return json({ error: "code:not_found" }, 404);
    const { data: run } = await db.from("analysis_runs").select("id").eq("submission_id", sub.id).order("started_at", { ascending: false }).limit(1).maybeSingle();
    const { data } = run
      ? await db.from("findings").select("id, rule_code, finding_type, severity, status, evidence_text, explanation_ar, explanation_en, fix_ar, citation, t_start, t_end").eq("run_id", run.id)
      : { data: [] };
    return json({ data: { version: sub, findings: data ?? [] } });
  }
  if ((m = path.match(new RegExp(`^/v1/promotions/(${UUID})/decisions$`)))) {
    if (!need("decisions:read")) return json({ error: "code:scope" }, 403);
    const { data: p } = await db.from("promotions").select("id").eq("org_id", org).eq("id", m[1]).maybeSingle();
    if (!p) return json({ error: "code:not_found" }, 404);
    const { data } = await db.from("review_decisions").select("id, submission_id, decision, actor_role, reason_ids, reason_other, condition_ar, comment, from_status, to_status, created_at, prev_hash, hash")
      .eq("promotion_id", p.id).order("created_at");
    return json({ data });
  }
  return json({ error: "code:not_found" }, 404);
});
