// Shared helpers for eval scripts (Node). Reads backend/.env and supabase/functions/.env.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RuleRecord } from "../supabase/functions/_shared/types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

function parse(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
  );
}

/** process.env > backend/.env > supabase/functions/.env */
export function loadEnv(): (k: string) => string | undefined {
  const merged = { ...parse(path.resolve(here, "../supabase/functions/.env")), ...parse(path.resolve(here, "../.env")) };
  fs.mkdirSync(path.resolve(here, "results"), { recursive: true });
  return (k) => process.env[k] || merged[k] || undefined;
}

/**
 * Rules from the local seed file (no network). Only the fields the deterministic path needs are
 * parsed (code, category, titles); use it with --deterministic-only.
 */
export function loadSeedRules(): RuleRecord[] {
  const sql = fs.readFileSync(path.resolve(here, "../supabase/seed.sql"), "utf8");
  const re = /^\('([A-Z]+-[A-Z0-9-]+)',\s*'[0-9a-f-]+',\s*'(\w+)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'/gm;
  return [...sql.matchAll(re)].map(
    (m) => ({ code: m[1], category: m[2], title_ar: m[3], title_en: m[4], is_active: true }) as unknown as RuleRecord,
  );
}

/** Active rules from the hosted project (public read via RLS). */
export async function loadRules(env: (k: string) => string | undefined): Promise<RuleRecord[]> {
  const url = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in backend/.env");
  const res = await fetch(`${url}/rest/v1/rules?select=*&is_active=eq.true&order=code`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`rules fetch failed: ${res.status}`);
  return (await res.json()) as RuleRecord[];
}

/** Offline test input, not model results: read the existing illustrative seed rulebook verbatim. */
export function loadSeedRuleRecords(): RuleRecord[] {
  const sql = fs.readFileSync(path.resolve(here, "../supabase/seed.sql"), "utf8");
  const section = sql.split("-- 2. Rules")[1]?.split("on conflict")[0];
  if (!section) throw new Error("Seed rulebook not found");
  const header = section.match(/insert into public\.rules \(([^)]+)\)/)?.[1];
  if (!header) throw new Error("Seed rulebook columns not found");
  const columns = header.split(",").map((s) => s.trim());
  const rows = section.split("\n").filter((line) => line.startsWith("('"));
  return rows.map((line) => {
    const values = [...line.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1]!.replace(/''/g, "'"));
    if (values.length !== columns.length) throw new Error("Seed rulebook format changed; update the smoke input loader");
    return { ...Object.fromEntries(columns.map((c, i) => [c, values[i]])), applies_to_categories: [] } as unknown as RuleRecord;
  });
}
