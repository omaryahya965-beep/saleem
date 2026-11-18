// Runs a command with the LOCAL Supabase keys from `supabase status -o env` (never printed, never written to disk).
import { execFileSync, spawnSync } from "node:child_process";
const out = execFileSync("npx", ["supabase", "status", "--workdir", "backend", "-o", "env"], { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] });
const env = Object.fromEntries(out.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const r = spawnSync(process.argv[2], process.argv.slice(3), {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, SUPABASE_URL: env.API_URL, SUPABASE_ANON_KEY: env.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY },
});
process.exit(r.status ?? 1);
