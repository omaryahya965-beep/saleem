// One-click demo session broker. POST { persona } → { token_hash } that the client exchanges with
// supabase.auth.verifyOtp({ type: "magiclink", token_hash }) for a normal session. No password exists anywhere in the
// client: the demo users' passwords are random and never leave the seed.
//
// Refuses unless ALL hold:
//  - DEMO_MODE=true is set as a SERVER secret (never a VITE_ variable) in this (demo) environment;
//  - the persona is in the allow-list below (fixed emails under @demo.saleem.app);
//  - the user exists and EVERY one of its memberships is in a registered sandbox org (demo_sandbox_orgs), so a demo
//    login can never reach a real customer organisation, and the user is not a platform admin;
//  - the caller's IP (hashed) started fewer than DEMO_RATE_PER_HOUR sessions in the last hour (default 20).
// Every issued session is logged (demo_sessions + audit_events). Roles and permissions are the app's own (org_can).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders, json, log } from "../_shared/http.ts";

const env = (k: string) => Deno.env.get(k);
export const DEMO_PERSONAS: Record<string, string> = {
  owner: "owner@demo.saleem.app",
  admin: "orgadmin@demo.saleem.app",
  compliance_lead: "lead@demo.saleem.app",
  reviewer: "reviewer@demo.saleem.app",
  legal: "legal@demo.saleem.app",
  creator: "marketer@demo.saleem.app",
  external_uploader: "partner@demo.saleem.app",
  external_reviewer: "extreviewer@demo.saleem.app",
  viewer: "viewer@demo.saleem.app",
};

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (env("DEMO_MODE") !== "true") return json({ error: "demo_disabled" }, 404);

  const body = await req.json().catch(() => ({}));
  const persona = typeof body.persona === "string" ? body.persona : "";
  const email = DEMO_PERSONAS[persona];
  if (!email) return json({ error: "unknown_persona" }, 400);

  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await sha256(`${env("DEMO_IP_SALT") ?? "saleem-demo"}:${ip}`);
  // D187: default matches the documented 20 sessions per IP and hour; production sets DEMO_RATE_PER_HOUR explicitly.
  const limit = Number(env("DEMO_RATE_PER_HOUR") ?? 20);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("demo_sessions").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= limit) return json({ error: "rate_limited" }, 429);

  // The user must exist and be confined to sandbox organisations.
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return json({ error: "lookup_failed" }, 500);
  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return json({ error: "demo_not_seeded" }, 503);
  const [{ data: members }, { data: sandboxes }, { data: platformAdmin }] = await Promise.all([
    db.from("org_members").select("org_id").eq("user_id", user.id),
    db.from("demo_sandbox_orgs").select("org_id"),
    db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
  ]);
  const sandbox = new Set((sandboxes ?? []).map((s) => s.org_id));
  if (!members?.length || members.some((m) => !sandbox.has(m.org_id)) || (platformAdmin ?? []).length) {
    log("demo_login_refused", { persona, reason: "not_confined_to_sandbox" });
    return json({ error: "not_a_sandbox_user" }, 403);
  }

  const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return json({ error: "session_failed" }, 500);
  await db.from("demo_sessions").insert({ persona, user_id: user.id, ip_hash: ipHash });
  await db.from("audit_events").insert({ actor: user.id, action: "demo.session", target_table: "auth.users", target_id: user.id, meta: { persona } });
  log("demo_login", { persona });
  return json({ token_hash: link.properties.hashed_token, persona }, 200);
});
