// v2 Phase 7.2/7.3: outgoing webhook bodies and HMAC signatures (pure; used by webhooks-deliver).

export interface Delivery {
  id: number;
  event: "analysis.completed" | "review.submitted" | "review.decided" | string;
  payload: { event: string; org_id: string; occurred_at: string; data: Record<string, unknown> };
}

const enc = new TextEncoder();

/** `sha256=<hex>` of the raw body with the endpoint secret (header `x-saleem-signature`). */
export async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${body}`));
  return `sha256=${[...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const LABEL: Record<string, string> = {
  "analysis.completed": "اكتمل الفحص الآلي",
  "review.submitted": "أُرسل إعلان للمراجعة",
  "review.decided": "صدر قرار مراجعة",
};

/** One Arabic line for chat tools; links back to the promotion. No findings text is sent to chat. */
export function chatText(d: Delivery, appUrl: string): string {
  const data = d.payload.data;
  const title = typeof data["title"] === "string" ? `«${data["title"]}»` : "";
  const status = typeof data["status"] === "string" ? ` (${data["status"]})` : "";
  const link = typeof data["promotion_id"] === "string" ? ` ${appUrl.replace(/\/$/, "")}/promotions/${data["promotion_id"]}` : "";
  return `سليم: ${LABEL[d.event] ?? d.event} ${title}${status}${link}`.replace(/\s+/g, " ").trim();
}

/** Request body per endpoint kind. */
export function bodyFor(kind: "webhook" | "slack" | "teams", d: Delivery, appUrl: string): string {
  if (kind === "slack") return JSON.stringify({ text: chatText(d, appUrl) });
  if (kind === "teams") return JSON.stringify({ text: chatText(d, appUrl) });
  return JSON.stringify({ id: d.id, ...d.payload });
}
