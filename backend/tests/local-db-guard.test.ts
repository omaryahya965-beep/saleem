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
