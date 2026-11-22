// Isolation tests (RLS + storage + function auth) between two users, on the ISOLATED test stack only (D214):
// users are created on the fly — see tests/helpers/local-db.ts and helpers/db-guard.ts. Function checks also need
// SUPABASE_LOCAL_FUNCTIONS=1. Skipped outside `node scripts/isolated-stack.mjs run`. Creates one submission + one
// storage object for user A and removes the storage object at the end.
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createUser, localDb } from "./helpers/local-db.ts";

// D214: the isolated test stack only. The former «live» mode (VITE_SUPABASE_URL + TEST_USER_* credentials) could reach
// a hosted project and is removed.
const local = localDb();
const enabled = Boolean(local);
const functionsAvailable = process.env["SUPABASE_LOCAL_FUNCTIONS"] === "1";

describe.skipIf(!enabled)("isolation between two users (isolated stack)", () => {
  let A: { db: SupabaseClient; id: string };
  let B: { db: SupabaseClient; id: string };
  const sid = crypto.randomUUID();
  let path = "";

  beforeAll(async () => {
    A = await createUser(local!, "iso-a");
    B = await createUser(local!, "iso-b");
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

  it.skipIf(!functionsAvailable)("analyze and cleanup-media reject other users", async () => {
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

describe.runIf(!enabled)("isolation — skipped", () => {
  it("needs a local Supabase (SUPABASE_LOCAL_*) or TEST_USER_A_*/TEST_USER_B_* in backend/.env", () => {
    console.warn("[isolation] skipped: start local Supabase and set SUPABASE_LOCAL_* (see tests/helpers/local-db.ts)");
  });
});
