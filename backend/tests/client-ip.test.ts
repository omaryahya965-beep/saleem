// D204: the demo rate limit must not be keyed on a client-controlled address.
import { describe, expect, it } from "vitest";
import { clientIp } from "../supabase/functions/_shared/http.ts";

describe("clientIp", () => {
  it("prefers the edge header over a forged X-Forwarded-For", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 9.9.9.9", "cf-connecting-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("uses the last (proxy-appended) hop, never the client-supplied first one", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
  });
  it("rotating a fake first hop does not change the key", () => {
    const a = clientIp(new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }));
    const b = clientIp(new Headers({ "x-forwarded-for": "10.0.0.2, 203.0.113.7" }));
    expect(a).toBe(b);
  });
  it("falls back to unknown", () => expect(clientIp(new Headers())).toBe("unknown"));
});
