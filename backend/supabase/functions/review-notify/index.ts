// SALEEM review-notify — emails the review-workflow notifications that the review RPCs created in-app.
// POST { promotion_id } with the caller's JWT, right after a successful review action. Sends each pending
// review_* notification of that promotion once (emailed_at), respecting profiles.notify_email.
// The caller must be able to read the promotion; recipients only ever get their own notifications.
import { serviceClient, userClient } from "../_shared/clients.ts";
import { corsHeaders, json, log } from "../_shared/http.ts";
import { emailProvider, reviewEmail, type ReviewKind } from "../_shared/notify.ts";

const env = (k: string) => Deno.env.get(k);
const KINDS: ReviewKind[] = ["review_submitted", "review_assigned", "review_decided", "review_escalated", "review_legal_response"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing authorization" }, 401);
  const body = await req.json().catch(() => ({}));
  const promotionId = typeof body.promotion_id === "string" ? body.promotion_id : null;
  if (!promotionId) return json({ error: "promotion_id is required" }, 400);

  // Access check with the caller's own rights (RLS), then send with the service role.
  const asUser = userClient(token);
  const { data: promo } = await asUser.from("promotions").select("id, title").eq("id", promotionId).maybeSingle();
  if (!promo) return json({ error: "not found" }, 404);

  const db = serviceClient();
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: pending } = await db
    .from("notifications")
    .select("id, user_id, kind, payload")
    .in("kind", KINDS)
    .is("emailed_at", null)
    .gte("created_at", since)
    .eq("payload->>promotion_id", promotionId)
    .limit(50);
  const base = env("APP_URL") ?? "https://saleem.app";
  let sent = 0;
  for (const n of pending ?? []) {
    try {
      const { data: profile } = await db.from("profiles").select("notify_email, preferred_lang").eq("id", n.user_id).maybeSingle();
      if (profile?.notify_email !== false) {
        const { data: u } = await db.auth.admin.getUserById(n.user_id);
        if (u?.user?.email) {
          const payload = (n.payload ?? {}) as { title?: string; decision?: string };
          const msg = reviewEmail({
            kind: n.kind as ReviewKind,
            title: payload.title ?? promo.title,
            decision: payload.decision ?? null,
            url: `${base}/promotions/${promotionId}`,
            lang: profile?.preferred_lang === "en" ? "en" : "ar",
          });
          await emailProvider(env).send({ to: u.user.email, ...msg });
          sent++;
        }
      }
      await db.from("notifications").update({ emailed_at: new Date().toISOString() }).eq("id", n.id);
    } catch (e) {
      log("review_notify_failed", { notification_id: n.id, error: (e as Error).message });
    }
  }
  return json({ sent });
});
