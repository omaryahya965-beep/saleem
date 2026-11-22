import { describe, expect, it } from "vitest";
import { isLocalUrl } from "./helpers/local-db.ts";

describe("local database guard", () => {
  it("accepts only local URLs", () => {
    expect(isLocalUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalUrl("http://localhost:54321/")).toBe(true);
    expect(isLocalUrl("https://abc.supabase.co")).toBe(false);
    expect(isLocalUrl("http://127.0.0.1.evil.com")).toBe(false);
    expect(isLocalUrl(undefined)).toBe(false);
  });
});

// D214: only the isolated test stack may ever be targeted.
import { assertIsolatedTarget, isolatedDb, TestTargetError } from "./helpers/db-guard.ts";

describe("database test guard (D214)", () => {
  const ISO = { SALEEM_ISO: "1", SUPABASE_LOCAL_URL: "http://127.0.0.1:54421", SUPABASE_LOCAL_ANON_KEY: "a", SUPABASE_LOCAL_SERVICE_ROLE_KEY: "s" };
  it("refuses the development stack, a hosted project and an unflagged isolated URL", () => {
    expect(() => assertIsolatedTarget({ SUPABASE_LOCAL_URL: "http://127.0.0.1:54321" })).toThrow(TestTargetError);
    expect(() => assertIsolatedTarget({ SALEEM_ISO: "1", SUPABASE_LOCAL_URL: "http://127.0.0.1:54321" })).toThrow(TestTargetError);
    expect(() => assertIsolatedTarget({ SUPABASE_URL: "https://abc.supabase.co" })).toThrow(TestTargetError);
    expect(() => assertIsolatedTarget({ SUPABASE_LOCAL_URL: "http://127.0.0.1:54421" })).toThrow(/SALEEM_ISO/);
  });
  it("accepts only the isolated stack, and skips (null) when nothing is configured", () => {
    expect(isolatedDb(ISO)?.url).toBe("http://127.0.0.1:54421");
    expect(isolatedDb({})).toBeNull();
  });
});
