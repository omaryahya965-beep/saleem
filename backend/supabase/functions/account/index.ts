// SALEEM account — self-service account deletion (PDPL right to erasure).
// POST { action: "delete", confirm: "<the user's email>" } with the user's JWT.
// Deletes the user's media, submissions (cascading findings, transcripts, runs, logs, shares),
// organizations they solely own, and finally the auth user (cascading profile, roles, notifications).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, json, log } from "../_shared/http.ts";

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const { data: auth } = await db.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "invalid session" }, 401);

  const body = await req.json().catch(() => ({}));
  if (body.action !== "delete") return json({ error: "unknown action" }, 400);
  if (typeof body.confirm !== "string" || body.confirm.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return json({ error: "confirmation_mismatch" }, 400);
  }

  try {
    // Organizations where this user is the only owner but other members remain → block.
    const { data: owned } = await db.from("org_members").select("org_id").eq("user_id", user.id).eq("role", "owner");
    for (const o of owned ?? []) {
      const { count: owners } = await db.from("org_members").select("user_id", { count: "exact", head: true }).eq("org_id", o.org_id).eq("role", "owner");
      const { count: members } = await db.from("org_members").select("user_id", { count: "exact", head: true }).eq("org_id", o.org_id);
      if ((owners ?? 0) === 1 && (members ?? 0) > 1) return json({ error: "transfer_ownership_first", org_id: o.org_id }, 409);
      if ((members ?? 0) === 1) await db.from("organizations").delete().eq("id", o.org_id);
    }

    // Storage: everything under {user}/
    let removed = 0;
    const walk = async (prefix: string): Promise<string[]> => {
      const { data } = await db.storage.from("media").list(prefix, { limit: 1000 });
      const out: string[] = [];
      for (const it of data ?? []) {
        const p = `${prefix}/${it.name}`;
        if (it.id === null) out.push(...(await walk(p)));
        else out.push(p);
      }
      return out;
    };
    const paths = await walk(user.id);
    for (let i = 0; i < paths.length; i += 100) {
      const { data } = await db.storage.from("media").remove(paths.slice(i, i + 100));
      removed += data?.length ?? 0;
    }

    const { count } = await db.from("submissions").delete({ count: "exact" }).eq("user_id", user.id);
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw error;
    log("account_deleted", { user_id: user.id, submissions: count ?? 0, files: removed });
    return json({ deleted: true });
  } catch (e) {
    log("account_delete_failed", { user_id: user.id, error: (e as Error).message });
    return json({ error: "delete_failed" }, 500);
  }
});
