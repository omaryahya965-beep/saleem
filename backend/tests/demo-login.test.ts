// demo-login broker against the LOCAL stack (functions served with DEMO_MODE=true, `npm run demo:seed` done).
// Skipped otherwise. Checks: allow-list, a real session for the right user, sandbox confinement (a demo user who is
// also in a real organisation is refused), no credential in the response, every session audited.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const URL_ = process.env.SUPABASE_LOCAL_URL ?? "";
const ANON = process.env.SUPABASE_LOCAL_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY ?? "";
const fn = `${URL_}/functions/v1/demo-login`;
const reachable = await (async () => {
  if (!URL_ || !/127\.0\.0\.1|localhost/.test(URL_)) return false;
  try {
    const r = await fetch(fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON }, body: "{}" });
    return r.status === 400; // unknown persona = broker up with DEMO_MODE on
  } catch {
    return false;
  }
})();
const call = (persona: string) =>
  fetch(fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON }, body: JSON.stringify({ persona }) });
const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } });

describe.skipIf(!reachable)("demo-login broker (local)", () => {
  it("rejects personas outside the allow-list", async () => {
    expect((await call("superuser")).status).toBe(400);
    expect((await call("../admin")).status).toBe(400);
  });

  it("returns only a one-time token that yields a session for exactly that persona, and audits it", async () => {
    const r = await call("viewer");
    expect(r.status).toBe(200);
    const body = (await r.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["persona", "token_hash"]);
    expect(JSON.stringify(body)).not.toMatch(/password|refresh_token|access_token|@demo\.saleem\.app/);
    const c = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data, error } = await c.auth.verifyOtp({ type: "magiclink", token_hash: body.token_hash as string });
    expect(error).toBeNull();
    expect(data.user?.email).toBe("viewer@demo.saleem.app");
    expect(data.user?.app_metadata?.["demo"]).toBe(true);
    // The token is single-use.
    const again = await c.auth.verifyOtp({ type: "magiclink", token_hash: body.token_hash as string });
    expect(again.error).not.toBeNull();
    const { count } = await admin().from("demo_sessions").select("id", { count: "exact", head: true }).eq("persona", "viewer");
    expect(count ?? 0).toBeGreaterThan(0);
  });

  it("refuses a demo user who is also a member of a non-sandbox (real) organisation", async () => {
    const db = admin();
    const viewer = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === "viewer@demo.saleem.app")!;
    const { data: org } = await db.from("organizations").insert({ name: "منظمة حقيقية (اختبار)", created_by: viewer.id }).select("id").single();
    try {
      await db.from("org_members").insert({ org_id: org!.id, user_id: viewer.id, role: "viewer" });
      expect((await call("viewer")).status).toBe(403);
    } finally {
      await db.from("organizations").delete().eq("id", org!.id);
    }
    expect((await call("viewer")).status).toBe(200);
  });
});
