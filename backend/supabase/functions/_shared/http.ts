// Shared HTTP helpers for Edge Functions.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/** Structured JSON log line (one event per line; never log secrets or media). */
export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...fields }));
}

/**
 * D204: the caller's IP for rate limiting. The FIRST X-Forwarded-For entry is whatever the client sent, so keying a
 * limit on it lets anyone rotate fake addresses. Prefer the edge's own header (Cloudflare sets cf-connecting-ip and
 * overwrites a client-supplied one), then X-Real-IP, then the LAST X-Forwarded-For hop (appended by the proxy).
 */
export function clientIp(h: Headers): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.at(-1) ?? "unknown";
}
