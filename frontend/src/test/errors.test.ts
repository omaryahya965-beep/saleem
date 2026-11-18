import { describe, expect, it } from "vitest";
import { ApiError, classifyError } from "@/lib/api/errors";

describe("classifyError", () => {
  const pg = (code: string, message = "x", status?: number) =>
    ApiError.from({ message, code, status });
  it.each([
    [new TypeError("Failed to fetch"), "network"],
    [pg("PGRST301", "JWT expired", 401), "unauthorized"],
    [pg("42501", "permission denied for table products"), "forbidden"],
    [new ApiError("code:forbidden"), "forbidden"],
    [Object.assign(pg("PGRST116", "0 rows"), { code: "PGRST116" }), "not_found"],
    [pg("PGRST202", "Could not find the function public.org_can"), "schema"],
    [pg("42P01", 'relation "public.rule_mappings" does not exist'), "schema"],
    [new ApiError("provider_invalid_key"), "provider"],
    [pg("22P02", "invalid input syntax for type uuid"), "invalid"],
    [pg("XX000", "boom", 500), "server"],
  ])("%s → %s", (e, kind) => expect(classifyError(e)).toBe(kind));
  it("never calls a permission or schema problem a network failure", () => {
    expect(classifyError(pg("42501", "new row violates row-level security policy"))).not.toBe(
      "network",
    );
    expect(classifyError(pg("PGRST205", "Could not find the table in the schema cache"))).toBe(
      "schema",
    );
  });
});
