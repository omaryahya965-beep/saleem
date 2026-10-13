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

/** Active rules from the hosted project (public read via RLS). */
export async function loadRules(env: (k: string) => string | undefined): Promise<RuleRecord[]> {
  const url = env("VITE_SUPABASE_URL") ?? env("SUPABASE_URL");
  const key = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing in backend/.env");
  const res = await fetch(`${url}/rest/v1/rules?select=*&is_active=eq.true&order=code`, { headers: { apikey: key } });
  if (!res.ok) throw new Error(`rules fetch failed: ${res.status}`);
  return (await res.json()) as RuleRecord[];
}
