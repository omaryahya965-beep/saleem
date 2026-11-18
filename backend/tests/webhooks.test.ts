// Phase 7.2/7.3 — webhook signature and chat bodies.
import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { bodyFor, chatText, sign, type Delivery } from "../supabase/functions/_shared/webhooks.ts";

const d: Delivery = {
  id: 7,
  event: "review.decided",
  payload: { event: "review.decided", org_id: "o", occurred_at: "2026-11-18T00:00:00Z", data: { promotion_id: "p1", title: "حملة", status: "approved" } },
};

describe("webhooks", () => {
  it("signs timestamp.body with HMAC-SHA256", async () => {
    const body = bodyFor("webhook", d, "https://app.test");
    const expected = "sha256=" + createHmac("sha256", "s3cret").update(`123.${body}`).digest("hex");
    expect(await sign("s3cret", "123", body)).toBe(expected);
    expect(JSON.parse(body)).toMatchObject({ id: 7, event: "review.decided", data: { promotion_id: "p1" } });
  });
  it("chat bodies are one Arabic line with a link, no findings text", () => {
    expect(chatText(d, "https://app.test/")).toBe("سليم: صدر قرار مراجعة «حملة» (approved) https://app.test/promotions/p1");
    expect(JSON.parse(bodyFor("slack", d, "https://app.test"))).toEqual({ text: chatText(d, "https://app.test") });
  });
});
