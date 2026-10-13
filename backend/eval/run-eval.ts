// Evaluation harness.  npm run eval [-- --deterministic-only] [--case=<id>] [--upload]
//
// Runs every case in eval/cases.json through the same pipeline modules as production
// (deterministic checks + the configured vision/reasoning model, then merge) and reports
// per-rule hits / misses / false alarms, timestamp error, and time + cost per case.
// Results: eval/results/latest.json (+ a timestamped copy). With --upload and
// SUPABASE_SERVICE_ROLE_KEY set, also inserts a row into public.eval_runs for the admin page.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analysisProvider, config } from "../supabase/functions/_shared/providers/index.ts";
import { runDeterministicChecks } from "../supabase/functions/_shared/rules/deterministic.ts";
import { mergeAndFilterFindings } from "../supabase/functions/_shared/pipeline/merge.ts";
import { textCost } from "../supabase/functions/_shared/pipeline/cost.ts";
import { PROMPT_VERSION } from "../supabase/functions/_shared/pipeline/schema.ts";
import type { Finding, SubmissionData, TranscriptSegment } from "../supabase/functions/_shared/types.ts";
import { loadEnv, loadRules } from "./lib.ts";

interface Case {
  id: string;
  title: string;
  submission: Partial<SubmissionData>;
  segments: TranscriptSegment[];
  expected: { rule: string; t: number | null }[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const detOnly = args.includes("--deterministic-only");
const only = args.find((a) => a.startsWith("--case="))?.slice(7);
const upload = args.includes("--upload");
const env = loadEnv();
const cfg = config(env);

const { cases } = JSON.parse(fs.readFileSync(path.join(here, "cases.json"), "utf8")) as { cases: Case[] };
const rules = await loadRules(env);
const ruleCodes = new Set(rules.map((r) => r.code));

type RuleStats = { hits: number; misses: number; falseAlarms: number; tErrors: number[] };
const perRule: Record<string, RuleStats> = Object.fromEntries([...ruleCodes].map((c) => [c, { hits: 0, misses: 0, falseAlarms: 0, tErrors: [] }]));
const caseResults: unknown[] = [];
let totalCost = 0;
let totalMs = 0;

for (const c of cases.filter((x) => !only || x.id === only)) {
  const sub: SubmissionData = {
    id: c.id, is_demo: false, kind: "video", caption: "", platform: "snapchat", product_category: "other",
    is_paid_ad: false, has_written_contract: false, ai_used: false, status: "analyzing", progress: 0, current_step: "llm",
    ...c.submission,
  } as SubmissionData;
  const t0 = Date.now();
  let llmFindings: Finding[] = [];
  let cost = 0;
  let error: string | null = null;
  if (!detOnly) {
    try {
      const res = await analysisProvider(env).analyze({ submission: sub, segments: c.segments, rules, frames: [], duration: sub.duration_seconds ?? null });
      llmFindings = res.findings;
      cost = textCost(res.model, res.usage);
    } catch (e) {
      error = (e as Error).message.slice(0, 200);
    }
  }
  const det = runDeterministicChecks(sub, c.segments, []);
  const merged = mergeAndFilterFindings([...det.findings, ...llmFindings], ruleCodes).mergedFindings;
  const ms = Date.now() - t0;
  totalMs += ms;
  totalCost += cost;

  // Score: an expected rule is a hit if any finding has that rule code; extra codes are false alarms.
  const got = new Map<string, Finding[]>();
  for (const f of merged) got.set(f.rule_code, [...(got.get(f.rule_code) ?? []), f]);
  const expectedCodes = new Set(c.expected.map((e) => e.rule));
  const outcome: Record<string, string> = {};
  for (const e of c.expected) {
    const s = perRule[e.rule] ?? (perRule[e.rule] = { hits: 0, misses: 0, falseAlarms: 0, tErrors: [] });
    const fs_ = got.get(e.rule);
    if (fs_?.length) {
      s.hits++;
      outcome[e.rule] = "hit";
      if (e.t !== null) {
        const timed = fs_.filter((f) => f.t_start !== null);
        if (timed.length) s.tErrors.push(Math.min(...timed.map((f) => Math.abs((f.t_start ?? 0) - e.t!))));
      }
    } else {
      s.misses++;
      outcome[e.rule] = "miss";
    }
  }
  for (const code of got.keys()) {
    if (!expectedCodes.has(code)) {
      perRule[code]!.falseAlarms++;
      outcome[code] = "false_alarm";
    }
  }
  const ok = Object.values(outcome).every((o) => o === "hit");
  console.log(`${ok ? "✓" : "✗"} ${c.id.padEnd(20)} ${String(ms).padStart(6)} ms  $${cost.toFixed(4)}  ${JSON.stringify(outcome)}${error ? `  ERROR ${error}` : ""}`);
  caseResults.push({ id: c.id, title: c.title, ms, cost_usd: cost, outcome, error, findings: merged.map((f) => ({ rule: f.rule_code, severity: f.severity, t: f.t_start, source: f.source, confidence: f.confidence, evidence: f.evidence_text })) });
}

const rows = Object.entries(perRule)
  .filter(([, s]) => s.hits + s.misses + s.falseAlarms > 0)
  .map(([rule, s]) => ({
    rule,
    hits: s.hits,
    misses: s.misses,
    false_alarms: s.falseAlarms,
    recall: s.hits + s.misses ? s.hits / (s.hits + s.misses) : null,
    precision: s.hits + s.falseAlarms ? s.hits / (s.hits + s.falseAlarms) : null,
    mean_t_error_s: s.tErrors.length ? s.tErrors.reduce((a, b) => a + b, 0) / s.tErrors.length : null,
  }));
const tot = rows.reduce((a, r) => ({ h: a.h + r.hits, m: a.m + r.misses, f: a.f + r.false_alarms }), { h: 0, m: 0, f: 0 });
const n = caseResults.length;
const summary = {
  cases: n,
  mode: detOnly ? "deterministic-only" : "deterministic+llm",
  recall: tot.h / Math.max(1, tot.h + tot.m),
  precision: tot.h / Math.max(1, tot.h + tot.f),
  hits: tot.h,
  misses: tot.m,
  false_alarms: tot.f,
  avg_ms_per_case: Math.round(totalMs / Math.max(1, n)),
  avg_cost_usd_per_case: totalCost / Math.max(1, n),
  total_cost_usd: totalCost,
};

console.log("\nPer rule:");
console.table(rows.map((r) => ({ ...r, recall: r.recall?.toFixed(2), precision: r.precision?.toFixed(2), mean_t_error_s: r.mean_t_error_s?.toFixed(1) })));
console.log("Summary:", summary);

const result = { at: new Date().toISOString(), llm_model: detOnly ? null : cfg.llmModel, prompt_version: PROMPT_VERSION, summary, per_rule: rows, cases: caseResults };
const outDir = path.join(here, "results");
fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(outDir, `eval-${result.at.replace(/[:.]/g, "-")}.json`), JSON.stringify(result, null, 2));

if (upload) {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    console.warn("--upload skipped: SUPABASE_SERVICE_ROLE_KEY not set in backend/.env");
  } else {
    const res = await fetch(`${url}/rest/v1/eval_runs`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ label: `eval ${result.at}`, llm_model: result.llm_model, prompt_version: PROMPT_VERSION, mode: "text", summary, per_rule: rows, cases: caseResults }),
    });
    console.log(res.ok ? "uploaded to eval_runs" : `upload failed: ${res.status} ${await res.text()}`);
  }
}
