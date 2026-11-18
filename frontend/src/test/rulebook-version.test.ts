// Adapted from PR #1 (ahmad daghra) to the v2 fetchReport: a historical report cites the rulebook
// version its own analysis used, even after a newer rulebook is published.
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as { table: string; column: string; value: unknown }[]);
vi.mock("@/lib/supabase", () => ({
  IS_DEMO_MODE: false,
  supabase: {
    from(table: string) {
      const filters = new Map<string, unknown>();
      const rows = () => {
        const version = filters.get("id") ?? "current-version";
        if (table === "rulebook_versions")
          return [{ id: version, version_label: version === "old-version" ? "v1" : "v2" }];
        if (table === "rules") {
          const id = filters.get("rulebook_version_id");
          return [
            {
              code: "COM-01",
              rulebook_version_id: id,
              source_url:
                id === "old-version"
                  ? "https://mc.gov.sa/old-reference"
                  : "https://mc.gov.sa/new-reference",
            },
          ];
        }
        if (table === "submissions")
          return [{ id: "submission", file_path: null, parent_id: null }];
        if (table === "analysis_runs")
          return [{ id: "run", rulebook_version_id: "old-version", rulebook_version: "v1" }];
        if (table === "findings")
          return [{ id: "finding", rule_code: "COM-01", evidence_frame_id: null }];
        return [];
      };
      const result = () => ({ data: rows(), error: null });
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          calls.push({ table, column, value });
          filters.set(column, value);
          return query;
        },
        limit() {
          return query;
        },
        in() {
          return query;
        },
        is() {
          return query;
        },
        neq() {
          return query;
        },
        order() {
          return query;
        },
        async single() {
          return { data: rows()[0] ?? null, error: null };
        },
        async maybeSingle() {
          return { data: rows()[0] ?? null, error: null };
        },
        then(resolve: (value: ReturnType<typeof result>) => unknown) {
          return Promise.resolve(result()).then(resolve);
        },
      };
      return query;
    },
  },
}));

import { fetchReport } from "@/lib/api/data";

describe("rulebook source version", () => {
  it("resolves historical report references from the run version after a new rulebook is published", async () => {
    calls.length = 0;
    const report = await fetchReport("submission");
    expect(report.rulebookVersion).toBe("v1");
    expect(report.rules.get("COM-01")?.source_url).toBe("https://mc.gov.sa/old-reference");
    expect(calls).toContainEqual({
      table: "rules",
      column: "rulebook_version_id",
      value: "old-version",
    });
  });
});
