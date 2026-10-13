// SALEEM cleanup-media — deletes stored media while keeping findings, transcript and hashes.
//
// Two callers:
//  • A signed-in owner: POST { submission_id } with their JWT → deletes that submission's media now.
//  • The hourly pg_cron job: POST {} with header x-cron-secret → deletes media of submissions analyzed
//    more than 24 h ago, and orphaned uploads (no submission row) older than 24 h.
// Deployed with verify_jwt = false because the cron caller has no JWT; both paths are verified here.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, log } from "../_shared/http.ts";

const env = (k: string) => Deno.env.get(k);
const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Recursively lists every object under a prefix. */
async function listAll(db: SupabaseClient, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const { data } = await db.storage.from("media").list(prefix, { limit: 1000 });
  for (const item of data ?? []) {
    const path = `${prefix}/${item.name}`;
    if (item.id === null) out.push(...(await listAll(db, path))); // folder
    else out.push(path);
  }
  return out;
}

async function purge(db: SupabaseClient, sub: { id: string; user_id: string | null }): Promise<number> {
  let removed = 0;
  if (sub.user_id) {
    const paths = await listAll(db, `${sub.user_id}/${sub.id}`);
    for (let i = 0; i < paths.length; i += 100) {
      const { data, error } = await db.storage.from("media").remove(paths.slice(i, i + 100));
      if (error) throw error;
      removed += data?.length ?? 0;
    }
  }
  await db
    .from("submissions")
    .update({ media_deleted_at: new Date().toISOString(), file_path: null, audio_path: null, thumbnail_path: null })
    .eq("id", sub.id);
  await db.from("frames").update({ image_path: null }).eq("submission_id", sub.id);
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));

  try {
    // ---- Owner-initiated deletion ------------------------------------------------------
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (typeof body.submission_id === "string") {
      if (!token) return json({ error: "missing authorization" }, 401);
      const { data: auth } = await db.auth.getUser(token);
      if (!auth?.user) return json({ error: "invalid session" }, 401);
      const { data: sub } = await db
        .from("submissions")
        .select("id, user_id, is_demo, media_deleted_at")
        .eq("id", body.submission_id)
        .maybeSingle();
      if (!sub || sub.user_id !== auth.user.id || sub.is_demo) return json({ error: "not found" }, 404);
      if (sub.media_deleted_at) return json({ files_removed: 0, already_deleted: true });
      const removed = await purge(db, sub);
      log("media_deleted", { submission_id: sub.id, by: "owner", files: removed });
      return json({ files_removed: removed });
    }

    // ---- Scheduled cleanup ---------------------------------------------------------------
    const secret = req.headers.get("x-cron-secret") ?? "";
    const { data: ok } = await db.rpc("verify_cron_secret", { _secret: secret });
    if (!secret || ok !== true) return json({ error: "forbidden" }, 403);

    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const { data: due, error } = await db
      .from("submissions")
      .select("id, user_id")
      .is("media_deleted_at", null)
      .eq("is_demo", false)
      .or(`analyzed_at.lt.${cutoff},and(status.eq.failed,created_at.lt.${cutoff})`)
      .limit(100);
    if (error) throw error;

    let files = 0;
    for (const sub of due ?? []) files += await purge(db, sub);

    // Orphans: folders whose submission row never got created (e.g. upload then tab closed).
    let orphans = 0;
    const { data: users } = await db.storage.from("media").list("", { limit: 1000 });
    for (const u of users ?? []) {
      if (u.id !== null) continue;
      const { data: subs } = await db.storage.from("media").list(u.name, { limit: 1000 });
      const ids = (subs ?? []).filter((s) => s.id === null).map((s) => s.name);
      if (!ids.length) continue;
      const { data: known } = await db.from("submissions").select("id").in("id", ids);
      const knownSet = new Set((known ?? []).map((k) => k.id));
      for (const sid of ids.filter((i) => !knownSet.has(i))) {
        const paths = await listAll(db, `${u.name}/${sid}`);
        const { data: meta } = await db.storage.from("media").list(`${u.name}/${sid}`, { limit: 1 });
        const created = meta?.[0]?.created_at ? new Date(meta[0].created_at).getTime() : 0;
        if (Date.now() - created < RETENTION_MS) continue;
        if (paths.length) await db.storage.from("media").remove(paths);
        orphans += paths.length;
      }
    }

    log("cleanup_run", { submissions: due?.length ?? 0, files, orphan_files: orphans });
    return json({ cleaned_submissions: due?.length ?? 0, files_removed: files, orphan_files_removed: orphans });
  } catch (e) {
    log("cleanup_error", { error: (e as Error).message });
    return json({ error: "cleanup failed" }, 500);
  }
});
