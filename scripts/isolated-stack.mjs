// Disposable, isolated local Supabase stack for destructive / polluting tests (D186).
// Your development database (project_id "saleem", ports 5432x) is never reset, truncated or written by tests.
//
//   node scripts/isolated-stack.mjs sync    copy config, migrations, seed, tests, functions into .iso/ (ports 5442x)
//   node scripts/isolated-stack.mjs start   sync + `supabase start` the isolated stack (project_id saleem_iso)
//   node scripts/isolated-stack.mjs reset   sync + `supabase db reset` — ONLY the isolated stack
//   node scripts/isolated-stack.mjs test    sync + pgTAP (`supabase test db`) on the isolated stack
//   node scripts/isolated-stack.mjs env     print the isolated API URL (keys are read by run-iso, never printed)
//   node scripts/isolated-stack.mjs run -- <cmd>   run a command with SUPABASE_LOCAL_* pointing at the isolated stack
//   node scripts/isolated-stack.mjs stop    stop the isolated stack (its data is disposable)
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "backend", "supabase");
const iso = join(root, ".iso");
const dst = join(iso, "supabase");
const cmd = process.argv[2] ?? "start";

function sync() {
  if (!existsSync(join(src, "config.toml")))
    throw new Error("run from the repository root");
  mkdirSync(dst, { recursive: true });
  for (const d of ["migrations", "tests", "functions"]) {
    rmSync(join(dst, d), { recursive: true, force: true });
    cpSync(join(src, d), join(dst, d), { recursive: true });
  }
  cpSync(join(src, "seed.sql"), join(dst, "seed.sql"));
  // D201: automated runs on the isolated stack must never spend AI quota by accident (accepting a corrected video
  // starts a real analysis). The Gemini key is blanked unless ISO_ALLOW_REAL_AI=1 is set for a deliberate run.
  const fenv = join(dst, "functions", ".env");
  if (existsSync(fenv) && process.env.ISO_ALLOW_REAL_AI !== "1")
    writeFileSync(
      fenv,
      readFileSync(fenv, "utf8").replace(
        /^GEMINI_API_KEY=.*$/m,
        "GEMINI_API_KEY=",
      ) +
        // D211: ISO_TEST_PROVIDER=1 runs analyses with the deterministic test providers (no network call, runs
        // labelled «deterministic-test»); the demo cap then counts those free runs. Otherwise analyses fail fast.
        (process.env.ISO_TEST_PROVIDER === "1"
          ? "\nSALEEM_TEST_PROVIDER=deterministic\nDEMO_AI_DAILY_LIMIT=30\n"
          : "\nDEMO_AI_DAILY_LIMIT=0\n"),
    );
  // Same configuration, different project and ports (+100), heavy optional services off.
  let cfg = readFileSync(join(src, "config.toml"), "utf8")
    .replace(/^project_id = ".*"$/m, 'project_id = "saleem_iso"')
    .replace(/\b543(2\d)\b/g, (_, d) => `544${d}`)
    .replace(/^inspector_port = 8083$/m, "inspector_port = 8183");
  for (const section of ["studio", "analytics", "realtime"])
    cfg = cfg.replace(
      new RegExp(`(\\[${section}\\]\\r?\\n)enabled = true`),
      "$1enabled = false",
    );
  writeFileSync(join(dst, "config.toml"), cfg);
}
const supa = (...args) => {
  const r = spawnSync("npx", ["supabase", ...args, "--workdir", `"${iso}"`], {
    stdio: "inherit",
    shell: true,
  });
  if (r.status) process.exit(r.status);
};
function isoEnv() {
  const out = execFileSync(
    "npx",
    ["supabase", "status", "--workdir", `"${iso}"`, "-o", "env"],
    {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  const env = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((l) => l.match(/^([A-Z_]+)="?([^"]*)"?$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2]]),
  );
  if (!/:544\d\d/.test(env.API_URL ?? ""))
    throw new Error(`refusing: ${env.API_URL} is not the isolated stack`);
  return env;
}

if (cmd === "sync") sync();
else if (cmd === "start") (sync(), supa("start"));
else if (cmd === "reset") (sync(), supa("db", "reset", "--local"));
else if (cmd === "test") (sync(), supa("test", "db"));
else if (cmd === "stop") supa("stop");
else if (cmd === "env") console.log(isoEnv().API_URL);
else if (cmd === "run") {
  const env = isoEnv();
  const argv = process.argv.slice(process.argv.indexOf("--") + 1);
  const r = spawnSync(argv[0], argv.slice(1), {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      SALEEM_ISO: "1",
      DEMO_STATE_DIR: join(iso, "demo"),
      SUPABASE_LOCAL_URL: env.API_URL,
      SUPABASE_LOCAL_ANON_KEY: env.ANON_KEY,
      SUPABASE_LOCAL_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
      SUPABASE_URL: env.API_URL,
      SUPABASE_ANON_KEY: env.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY,
    },
  });
  process.exit(r.status ?? 1);
} else throw new Error(`unknown command ${cmd}`);
