// Live isolation tests against the hosted project (RLS + storage + function auth).
// Requires two confirmed test accounts in backend/.env:
//   TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL / TEST_USER_B_PASSWORD
// Skipped automatically when they are missing. Creates one submission + one storage object
// for user A and removes the storage object at the end.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../eval/lib.ts";

const env = loadEnv();
const url = env("VITE_SUPABASE_URL");
const key = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const creds = {
  a: { email: env("TEST_USER_A_EMAIL"), password: env("TEST_USER_A_PASSWORD") },
  b: { email: env("TEST_USER_B_EMAIL"), password: env("TEST_USER_B_PASSWORD") },
};
const enabled = Boolean(url && key && creds.a.email && creds.a.password && creds.b.email && creds.b.password);

async function signIn(c: { email?: string; password?: string }): Promise<{ db: SupabaseClient; id: string }> {
  const db = createClient(url!, key!, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: c.email!, password: c.password! });
  if (error || !data.user) throw error ?? new Error("sign-in failed");
  return { db, id: data.user.id };
}

describe.skipIf(!enabled)("isolation between two users (live)", () => {
  let A: { db: SupabaseClient; id: string };
  let B: { db: SupabaseClient; id: string };
  const sid = crypto.randomUUID();
  let path = "";

  beforeAll(async () => {
    A = await signIn(creds.a);
    B = await signIn(creds.b);
    path = `${A.id}/${sid}/original.jpg`;
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const up = await A.db.storage.from("media").upload(path, new Blob([jpeg], { type: "image/jpeg" }));
    expect(up.error).toBeNull();
    const ins = await A.db.from("submissions").insert({
      id: sid, user_id: A.id, kind: "image", caption: "isolation test", platform: "x", product_category: "other",
      file_path: path, title: "isolation-test",
      // The trigger must override these client-sent values:
      status: "done", overall_status: "ready", progress: 100,
    } as never);
    expect(ins.error).toBeNull();
  });

  afterAll(async () => {
    if (path) await A.db.storage.from("media").remove([path]);
  });

  it("forces new submissions to start queued (no forged 'ready')", async () => {
    const { data } = await A.db.from("submissions").select("status, overall_status, progress").eq("id", sid).single();
    expect(data).toMatchObject({ status: "queued", overall_status: null, progress: 0 });
  });

  it("owner cannot write status or findings directly", async () => {
    const upd = await A.db.from("submissions").update({ status: "done", overall_status: "ready" } as never).eq("id", sid);
    expect(upd.error).not.toBeNull();
    const f = await A.db.from("findings").insert({ run_id: sid, submission_id: sid, rule_code: "MAW-01", severity: "warning", evidence_type: "metadata", source: "llm" } as never);
    expect(f.error).not.toBeNull();
  });

  it("user B cannot read A's submission row", async () => {
    const { data } = await B.db.from("submissions").select("id").eq("id", sid);
    expect(data).toEqual([]);
  });

  it("user B cannot read, list, overwrite or delete A's media", async () => {
    const dl = await B.db.storage.from("media").download(path);
    expect(dl.data).toBeNull();
    const signed = await B.db.storage.from("media").createSignedUrl(path, 60);
    expect(signed.data).toBeNull();
    const list = await B.db.storage.from("media").list(`${A.id}/${sid}`);
    expect(list.data ?? []).toEqual([]);
    const over = await B.db.storage.from("media").upload(path, new Blob(["x"]), { upsert: true });
    expect(over.error).not.toBeNull();
    await B.db.storage.from("media").remove([path]);
    const still = await A.db.storage.from("media").download(path);
    expect(still.data).not.toBeNull();
  });

  it("user B cannot write into A's folder", async () => {
    const up = await B.db.storage.from("media").upload(`${A.id}/${crypto.randomUUID()}/x.jpg`, new Blob(["x"], { type: "image/jpeg" }));
    expect(up.error).not.toBeNull();
  });

  it("analyze and cleanup-media reject other users", async () => {
    const r1 = await B.db.functions.invoke("analyze", { body: { submission_id: sid } });
    expect(r1.error).not.toBeNull();
    const r2 = await B.db.functions.invoke("cleanup-media", { body: { submission_id: sid } });
    expect(r2.error).not.toBeNull();
  });

  it("user B cannot cancel A's submission", async () => {
    const r = await B.db.rpc("cancel_submission", { _sid: sid });
    expect(r.error).not.toBeNull();
  });
});

describe.runIf(!enabled)("isolation (live) — skipped", () => {
  it("needs TEST_USER_A_* and TEST_USER_B_* in backend/.env", () => {
    console.warn("[isolation] skipped: add two confirmed test accounts to backend/.env to run live RLS/storage tests");
  });
});
