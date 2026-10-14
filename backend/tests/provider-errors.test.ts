import { describe, expect, it } from "vitest";
import {
  PROVIDER_ERROR_MESSAGES,
  classifyProviderError,
  errorToken,
  type ProviderErrorCode,
} from "../supabase/functions/_shared/providers/errors.ts";

const body = (type: string, message = "x") => JSON.stringify({ error: { type, code: type, message } });

describe("classifyProviderError", () => {
  it.each<[number | null, string, ProviderErrorCode]>([
    [401, body("invalid_api_key", "Incorrect API key provided: sk-abc123****"), "invalid_key"],
    [403, body("model_not_allowed", "Project does not have access to model"), "no_access"],
    [404, body("model_not_found", "The model `gpt-x` does not exist"), "model_not_found"],
    [429, body("insufficient_quota", "You exceeded your current quota, please check your plan and billing"), "insufficient_quota"],
    [429, body("rate_limit_exceeded", "Rate limit reached for requests"), "rate_limited"],
    [400, body("invalid_request_error", "Unrecognized file format"), "bad_request"],
    [413, "payload too large", "bad_request"],
    [500, "upstream error", "provider_down"],
    [503, body("server_error"), "provider_down"],
    [408, "timeout", "provider_down"],
    [null, "fetch failed", "provider_down"],
    [418, "teapot", "unknown"],
  ])("HTTP %s → %s", (status, b, code) => {
    expect(classifyProviderError(status, b).code).toBe(code);
  });

  it('uses "invalid key" ONLY for 401', () => {
    for (const s of [400, 403, 404, 429, 500, 503]) {
      expect(classifyProviderError(s, body("invalid_api_key")).code).not.toBe("invalid_key");
    }
  });

  it("keeps status, error type and request id; never echoes key material", () => {
    const info = classifyProviderError(401, body("invalid_api_key", "Incorrect API key provided: sk-proj-ABCDEFGHIJKLMNOP."), "req_123");
    expect(info).toMatchObject({ status: 401, type: "invalid_api_key", requestId: "req_123" });
    expect(info.detail).not.toMatch(/ABCDEFGHIJ/);
    expect(info.detail).toContain("sk-***");
  });
});

describe("provider error messages", () => {
  const codes = Object.keys(PROVIDER_ERROR_MESSAGES) as ProviderErrorCode[];
  it("every code has Arabic and English text", () => {
    for (const c of codes) {
      expect(PROVIDER_ERROR_MESSAGES[c].ar.length, c).toBeGreaterThan(10);
      expect(PROVIDER_ERROR_MESSAGES[c].en.length, c).toBeGreaterThan(10);
      expect(PROVIDER_ERROR_MESSAGES[c].ar).toMatch(/[؀-ۿ]/);
    }
  });
  it("only invalid_key mentions the key", () => {
    for (const c of codes) {
      const mentionsKey = /مفتاح/.test(PROVIDER_ERROR_MESSAGES[c].ar) || /\bkey\b/i.test(PROVIDER_ERROR_MESSAGES[c].en);
      expect(mentionsKey, c).toBe(c === "invalid_key");
    }
  });
  it("credit and rate-limit messages are distinct", () => {
    expect(PROVIDER_ERROR_MESSAGES.insufficient_quota.ar).not.toBe(PROVIDER_ERROR_MESSAGES.rate_limited.ar);
    expect(PROVIDER_ERROR_MESSAGES.insufficient_quota.en).toMatch(/credit/);
  });
  it("stores a translatable token", () => {
    expect(errorToken("insufficient_quota")).toBe("code:provider_insufficient_quota");
  });
});
