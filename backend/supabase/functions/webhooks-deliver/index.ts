// SALEEM webhooks-deliver (Phase 7.2/7.3) — sends queued webhook / Slack / Teams deliveries.
// Called every minute by pg_cron (invoke_webhooks_deliver) with header x-cron-secret. Webhooks are signed with
// HMAC-SHA256 (x-saleem-signature, x-saleem-timestamp); failures retry with backoff (webhook_attempt).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { bodyFor, sign, type Delivery } from "../_shared/webhooks.ts";

const env = (k: string) => Deno.env.get(k);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const secret = req.headers.get("x-cron-secret") ?? "";
  const { data: ok } = await db.rpc("verify_cron_secret", { _secret: secret });
  if (!secret || ok !== true) return json({ error: "forbidden" }, 403);

  const { data: due, error } = await db
    .from("webhook_deliveries")
    .select("id, event, payload, endpoint:webhook_endpoints(kind, url, secret, active)")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at")
    .limit(50);
  if (error) return json({ error: "lookup failed" }, 500);
  const appUrl = env("APP_URL") ?? "https://saleem.app";
  let sent = 0;
  for (const row of due ?? []) {
    const ep = row.endpoint as unknown as { kind: "webhook" | "slack" | "teams"; url: string; secret: string; active: boolean } | null;
    if (!ep?.active) {
      await db.rpc("webhook_attempt", { _id: row.id, _ok: false, _code: 0, _error: "endpoint inactive" });
      continue;
    }
    const d = row as unknown as Delivery;
    const body = bodyFor(ep.kind, d, appUrl);
    const ts = String(Math.floor(Date.now() / 1000));
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ep.kind === "webhook") {
      headers["x-saleem-event"] = d.event;
      headers["x-saleem-timestamp"] = ts;
      headers["x-saleem-signature"] = await sign(ep.secret, ts, body);
    }
    try {
      const res = await fetch(ep.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
      await db.rpc("webhook_attempt", { _id: row.id, _ok: res.ok, _code: res.status, _error: res.ok ? null : (await res.text()).slice(0, 300) });
      if (res.ok) sent++;
    } catch (e) {
      await db.rpc("webhook_attempt", { _id: row.id, _ok: false, _code: 0, _error: String(e).slice(0, 300) });
    }
  }
  log("webhooks_delivered", { due: due?.length ?? 0, sent });
  return json({ due: due?.length ?? 0, sent });
});
