// Guards against a normal run depending on a scheduled job to finish. The pipeline must mark its own
// submission "done" in the same invocation; cron jobs may only fail stuck checks or clean up media.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../supabase");
const analyze = fs.readFileSync(path.join(root, "functions/analyze/index.ts"), "utf8");
const migrations = fs
  .readdirSync(path.join(root, "migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => ({ f, sql: fs.readFileSync(path.join(root, "migrations", f), "utf8") }));

/** Body of a top-level function in analyze/index.ts (up to the next top-level declaration). */
function body(name: string) {
  const start = analyze.indexOf(`async function ${name}(`);
  expect(start, `${name} exists`).toBeGreaterThan(-1);
  const rest = analyze.slice(start + 1);
  const end = rest.search(/\n(?:async function|function|Deno\.serve|const [A-Z_]+ =)/);
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("normal runs finish without the cron jobs", () => {
  const pipeline = body("runPipeline");

  it("the pipeline itself writes status done, before sealing and notifying", () => {
    const done = pipeline.indexOf(`status: "done"`, pipeline.indexOf("set_done"));
    expect(done).toBeGreaterThan(-1);
    expect(pipeline.indexOf("seal_compliance_log")).toBeGreaterThan(done);
    expect(pipeline.indexOf("notifyUser")).toBeGreaterThan(done);
  });

  it("no awaited sleeps or fixed waits in the pipeline", () => {
    expect(pipeline).not.toMatch(/setTimeout|sleep\(|delay\(/);
  });

  it("the handler keeps the run alive with waitUntil (no re-invocation needed)", () => {
    expect(analyze).toMatch(/EdgeRuntime\.waitUntil\(work\)/);
  });

  it("scheduled jobs never complete or advance a run", () => {
    const schedules = migrations.flatMap(({ f, sql }) =>
      [...sql.matchAll(/cron\.schedule\(\s*'([^']+)'[\s\S]*?\);/g)].map((m) => ({ f, name: m[1]!, text: m[0] })),
    );
    expect(schedules.length).toBeGreaterThan(0);
    for (const s of schedules) {
      expect(s.text, `${s.f}:${s.name}`).not.toMatch(/functions\/v1\/analyze/);
      expect(s.text, `${s.f}:${s.name}`).not.toMatch(/status\s*=\s*'done'/);
      expect(["saleem-cleanup-media", "saleem-fail-stuck"], `unexpected cron job ${s.name}`).toContain(s.name);
    }
  });

  it("the stuck-check job only fails checks idle for 10+ minutes", () => {
    const fn = migrations.map((m) => m.sql).join("\n").match(/create or replace function public\.fail_stuck_submissions\(\)[\s\S]*?end \$\$;/g)!.at(-1)!;
    expect(fn).toMatch(/set\s+status = 'failed'/);
    expect(fn).not.toMatch(/'done'/);
    expect(fn).toMatch(/interval '10 minutes'/);
  });
});
