import { describe, expect, it } from "vitest";
import { DEFAULT_RATE_LIMIT_PER_HOUR, isRateLimited, rateLimitFromEnv } from "../supabase/functions/_shared/pipeline/rate-limit.ts";

describe("analysis rate limit", () => {
  it("allows the 30th start and blocks the 31st (limit 30)", () => {
    expect(isRateLimited(29, 30)).toBe(false); // 30th start
    expect(isRateLimited(30, 30)).toBe(true); // 31st start
  });
  it("reads the limit from env with a safe default", () => {
    expect(rateLimitFromEnv(undefined)).toBe(DEFAULT_RATE_LIMIT_PER_HOUR);
    expect(rateLimitFromEnv("5")).toBe(5);
    expect(rateLimitFromEnv("0")).toBe(DEFAULT_RATE_LIMIT_PER_HOUR);
    expect(rateLimitFromEnv("abc")).toBe(DEFAULT_RATE_LIMIT_PER_HOUR);
  });
});
