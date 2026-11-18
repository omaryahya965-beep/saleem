// The latest schedule of the media-cleanup job must not hard-code a project URL (Phase 0, D72).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(__dirname, "../supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const latest = files
  .map((f) => ({ f, sql: fs.readFileSync(path.join(dir, f), "utf8") }))
  .filter(({ sql }) => /cron\.schedule\(\s*'saleem-cleanup-media'/.test(sql))
  .at(-1)!;

describe("media cleanup cron URL", () => {
  it("is scheduled last by a migration without a hard-coded URL", () => {
    expect(latest.f).toMatch(/v2_p0_cron_vault_url/);
    expect(latest.sql).not.toMatch(/https?:\/\//);
    expect(latest.sql).toMatch(/name = 'project_url'/);
    expect(latest.sql).toMatch(/x-cron-secret/);
  });
});
