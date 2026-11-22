// One-click demo session broker. POST { persona } → { token_hash } that the client exchanges with
// supabase.auth.verifyOtp({ type: "magiclink", token_hash }) for a normal session. No password exists anywhere in the
// client: the demo users' passwords are random and never leave the seed.
//
// Refuses unless ALL hold:
//  - DEMO_MODE=true is set as a SERVER secret (never a VITE_ variable) in this (demo) environment;
//  - the persona is in the allow-list below (fixed emails under @demo.saleem.app);
//  - the user exists and EVERY one of its memberships is in a registered sandbox org (demo_sandbox_orgs), so a demo
//    login can never reach a real customer organisation, and the user is not a platform admin;
//  - the «individual» persona instead has NO membership at all and a personal workspace flagged is_demo (D211);
//  - the caller's IP (hashed) started fewer than DEMO_RATE_PER_HOUR sessions in the last hour (default 20).
// Every issued session is logged (demo_sessions + audit_events). Roles and permissions are the app's own (org_can).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { clientIp, corsHeaders, json, log } from "../_shared/http.ts";

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
  // D211: the individual / content-creator demo. A personal workspace only: no organisation, no role.
  individual: "individual@demo.saleem.app",
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
  const ip = clientIp(req.headers);
  const ipHash = await sha256(`${env("DEMO_IP_SALT") ?? "saleem-demo"}:${ip}`);
  // D187: default matches the documented 20 sessions per IP and hour; production sets DEMO_RATE_PER_HOUR explicitly.
  const limit = Number(env("DEMO_RATE_PER_HOUR") ?? 20);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("demo_sessions").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= limit) return json({ error: "rate_limited" }, 429);

  // D215: the individual demo is per session — a fresh personal workspace for every visitor.
  if (persona === "individual") return await individualSession(db, ipHash);

  // The user must exist and be confined to sandbox organisations.
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return json({ error: "lookup_failed" }, 500);
  const user = list.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return json({ error: "demo_not_seeded" }, 503);
  const [{ data: members }, { data: sandboxes }, { data: platformAdmin }, { data: personal }] = await Promise.all([
    db.from("org_members").select("org_id").eq("user_id", user.id),
    db.from("demo_sandbox_orgs").select("org_id"),
    db.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin"),
    db.from("personal_workspaces").select("is_demo").eq("user_id", user.id).maybeSingle(),
  ]);
  const sandbox = new Set((sandboxes ?? []).map((s) => s.org_id));
  const confined = persona === "individual"
    ? !members?.length && personal?.is_demo === true
    : Boolean(members?.length) && !members!.some((m) => !sandbox.has(m.org_id));
  if (!confined || (platformAdmin ?? []).length) {
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

// ---- D215: per-session individual demo -------------------------------------------------------------------------
// Each «individual» demo login creates its own short-lived account (random email, random password that never leaves
// the server) with a personal workspace flagged is_demo and expiring after DEMO_SESSION_HOURS (2). Visitors therefore
// never see each other's uploads. The workspace is seeded with copies of the template account's text sample ads
// (individual@demo.saleem.app, created by the demo seed; nobody signs in as it). Shared AI protections are kept:
// is_demo personal workspaces count in the daily demo cap, and a session's data is purged only PURGE_AFTER_HOURS
// (26) after it expired, so its usage still counts during the 24-hour window. DEMO_MAX_PERSONAL_SESSIONS caps
// concurrent sessions (default 200).
// deno-lint-ignore no-explicit-any
type Db = ReturnType<typeof createClient<any>>;
const SESSION_HOURS = 2;
const PURGE_AFTER_HOURS = 26;

/**
 * Expired sessions (PURGE_AFTER_HOURS after expiry): their uploaded files are deleted and the account is banned for
 * good. Rows are NOT deleted: review_events / review_decisions are an immutable audit log (forbid_mutation) that
 * also covers personal versions, and weakening it is not this broker's call. A banned account can never sign in
 * again and RLS keeps its rows unreadable by anyone else.
 */
async function purgeExpired(db: Db) {
  const before = new Date(Date.now() - PURGE_AFTER_HOURS * 3600_000).toISOString();
  const { data: expired } = await db.from("personal_workspaces").select("user_id")
    .eq("is_demo", true).is("purged_at", null).not("expires_at", "is", null).lt("expires_at", before).limit(10);
  for (const { user_id: uid } of (expired ?? []) as { user_id: string }[]) {
    try {
      const { data: subs } = await db.from("submissions").select("id, file_path, audio_path, thumbnail_path").eq("user_id", uid);
      const sids = ((subs ?? []) as { id: string }[]).map((s) => s.id);
      const { data: frames } = sids.length ? await db.from("frames").select("image_path").in("submission_id", sids) : { data: [] };
      const paths = [
        ...((subs ?? []) as Record<string, string | null>[]).flatMap((s) => [s.file_path, s.audio_path, s.thumbnail_path]),
        ...((frames ?? []) as { image_path: string | null }[]).map((f) => f.image_path),
      ].filter((p): p is string => Boolean(p) && !p!.startsWith("demo:"));
      if (paths.length) await db.storage.from("media").remove(paths);
      const { error: banErr } = await db.auth.admin.updateUserById(uid, { ban_duration: "876000h" });
      if (banErr) throw banErr;
      await db.from("personal_workspaces").update({ purged_at: new Date().toISOString() }).eq("user_id", uid);
      log("demo_personal_purged", { files: paths.length });
    } catch (e) {
      log("demo_personal_purge_failed", { error: String(e).slice(0, 200) });
    }
  }
}

async function individualSession(db: Db, ipHash: string): Promise<Response> {
  await purgeExpired(db);
  const now = new Date().toISOString();
  const { count: active } = await db.from("personal_workspaces").select("user_id", { count: "exact", head: true })
    .eq("is_demo", true).gt("expires_at", now);
  if ((active ?? 0) >= Number(env("DEMO_MAX_PERSONAL_SESSIONS") ?? 200)) return json({ error: "rate_limited" }, 429);

  // The template account must exist and be a personal demo only (no organisation, not a platform admin).
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) return json({ error: "lookup_failed" }, 500);
  const template = list.users.find((u) => u.email?.toLowerCase() === DEMO_PERSONAS.individual);
  if (!template) return json({ error: "demo_not_seeded" }, 503);
  const [{ data: tMembers }, { data: tWorkspace }] = await Promise.all([
    db.from("org_members").select("org_id").eq("user_id", template.id),
    db.from("personal_workspaces").select("is_demo").eq("user_id", template.id).maybeSingle(),
  ]);
  if ((tMembers ?? []).length || (tWorkspace as { is_demo?: boolean } | null)?.is_demo !== true) {
    log("demo_login_refused", { persona: "individual", reason: "template_not_confined" });
    return json({ error: "not_a_sandbox_user" }, 403);
  }

  const rand = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(16).padStart(2, "0")).join("");
  const email = `individual-${rand}@demo.saleem.app`;
  const password = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { display_name: "صانع محتوى (تجريبي)" },
    app_metadata: { demo: true, ephemeral: true },
  });
  if (cErr || !created?.user) return json({ error: "session_failed" }, 500);
  const uid = created.user.id;
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString();
  const { error: wErr } = await db.from("personal_workspaces").insert({ user_id: uid, display_name: "صانع محتوى (تجريبي)", is_demo: true, expires_at: expires });
  if (wErr) {
    await db.auth.admin.deleteUser(uid);
    return json({ error: "session_failed" }, 500);
  }

  // Copies of the template's text sample ads (own rows of the new session; media is never copied).
  const { data: ads } = await db.from("promotions")
    .select("title, sector, channels, communication_type, audience, is_paid, distribution, caption, current_version_id")
    .eq("owner_id", template.id).is("org_id", null).neq("review_status", "archived").limit(5);
  for (const ad of (ads ?? []) as Record<string, unknown>[]) {
    const { data: v } = await db.from("submissions").select("kind, title, caption, text_content, platform, product_category, is_paid_ad, has_written_contract, ai_used")
      .eq("id", ad.current_version_id as string).maybeSingle();
    if (!v || (v as { kind: string }).kind !== "text") continue;
    const pid = crypto.randomUUID();
    const { error: pErr } = await db.from("promotions").insert({
      id: pid, owner_id: uid, org_id: null, title: ad.title, sector: ad.sector, channels: ad.channels,
      communication_type: ad.communication_type, audience: ad.audience, is_paid: ad.is_paid, distribution: ad.distribution, caption: ad.caption,
    });
    if (pErr) continue;
    await db.from("submissions").insert({ ...(v as Record<string, unknown>), id: crypto.randomUUID(), user_id: uid, promotion_id: pid, sha256: rand });
  }

  const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return json({ error: "session_failed" }, 500);
  await db.from("demo_sessions").insert({ persona: "individual", user_id: uid, ip_hash: ipHash });
  await db.from("audit_events").insert({ actor: uid, action: "demo.session", target_table: "auth.users", target_id: uid, meta: { persona: "individual", ephemeral: true, expires_at: expires } });
  log("demo_login", { persona: "individual", ephemeral: true });
  return json({ token_hash: link.properties.hashed_token, persona: "individual" }, 200);
}
