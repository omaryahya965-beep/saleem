// Prepare a disposable CLI project beside this checkout. Never links to a hosted project.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const target = path.resolve(root, "../saleem-local");
const source = path.join(root, "backend/supabase");
const local = path.join(target, "supabase");
fs.mkdirSync(path.join(local, "migrations"), { recursive: true });
let config = fs
  .readFileSync(path.join(source, "config.toml"), "utf8")
  .replace(/^project_id = .*$/m, 'project_id = "saleem-gemini-local"')
  .replace(/543(\d\d)/g, "554$1")
  .replace(/^site_url = .*$/m, 'site_url = "http://localhost:3001"')
  .replace(
    /^additional_redirect_urls = .*$/m,
    'additional_redirect_urls = ["http://localhost:3001/**", "http://127.0.0.1:3001/**"]',
  );
fs.writeFileSync(path.join(local, "config.toml"), config);
const migrationChanges = [];
for (const name of fs
  .readdirSync(path.join(source, "migrations"))
  .filter((n) => n.endsWith(".sql"))) {
  const original = fs.readFileSync(
    path.join(source, "migrations", name),
    "utf8",
  );
  const sql = original.replaceAll(
    "https://oxspzxtxvtwswdjqfful.supabase.co/functions/v1/cleanup-media",
    "http://supabase_kong_saleem-gemini-local:8000/functions/v1/cleanup-media",
  );
  if (sql !== original)
    migrationChanges.push({
      file: name,
      change: "cleanup HTTP target -> isolated local Kong",
    });
  fs.writeFileSync(path.join(local, "migrations", name), sql);
}
const seed = fs.readFileSync(path.join(source, "seed.sql"), "utf8");
// Later migrations reference demo runs whose rulebook already existed on the hosted DB.
// A fresh DB needs the existing rulebook seed before those migrations, not new model results.
const seedCut = seed.indexOf("-- 3.");
if (seedCut < 0)
  throw new Error("Existing seed layout changed; inspect local bootstrap");
const rulebookSeed = seed.slice(0, seedCut);
if (
  !rulebookSeed.includes("insert into public.rules") ||
  !rulebookSeed.includes("on conflict (code)")
)
  throw new Error("Existing seed layout changed; inspect local bootstrap");
fs.writeFileSync(
  path.join(local, "migrations/20261013000001_local_rulebook.sql"),
  rulebookSeed,
);
fs.writeFileSync(
  path.join(local, "seed.sql"),
  seed.replace(
    "on conflict (code)",
    "on conflict (rulebook_version_id, code)",
  ) +
    "\n-- Local synthetic demo fixtures need the same trusted sealing step as the real pipeline.\nselect public.seal_compliance_log(id) from public.submissions where is_demo;\n",
);
const functionsPath = path.join(local, "functions");
if (
  fs.existsSync(functionsPath) &&
  fs.lstatSync(functionsPath).isSymbolicLink()
)
  fs.unlinkSync(functionsPath);
// A real directory avoids cross-worktree bind-mount/symlink issues in Docker Desktop.
fs.cpSync(path.join(source, "functions"), functionsPath, {
  recursive: true,
  filter: (p) =>
    !path.basename(p).startsWith(".env") &&
    !["node_modules", ".DS_Store"].includes(path.basename(p)),
});
const envPath = path.join(source, "functions/.env");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const key =
  process.env.GEMINI_API_KEY ||
  envText
    .match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "");
const model =
  process.env.GEMINI_MODEL ||
  envText
    .match(/^\s*GEMINI_MODEL\s*=\s*(.*)$/m)?.[1]
    ?.trim()
    .replace(/^["']|["']$/g, "") ||
  "gemini-3.5-flash-lite";
if (!/^gemini-[a-z0-9.-]+$/.test(model))
  throw new Error("Invalid GEMINI_MODEL");
if (!key || key.startsWith("your-") || /[\r\n]/.test(key))
  throw new Error("A valid local Gemini credential is required");
fs.writeFileSync(
  path.join(target, ".env.functions"),
  `GEMINI_API_KEY=${key}\nGEMINI_MODEL=${model}\nLLM_PROVIDER=gemini\nTRANSCRIPTION_PROVIDER=gemini\nEMAIL_PROVIDER=console\nAPP_URL=http://localhost:3001\n`,
  { mode: 0o600 },
);
fs.chmodSync(path.join(target, ".env.functions"), 0o600);
// This directory is outside the Git checkout. An explicit ignore file also prevents accidental use.
fs.writeFileSync(path.join(target, ".gitignore"), "*\n");
fs.writeFileSync(
  path.join(target, "isolation.json"),
  JSON.stringify(
    {
      project: "saleem-gemini-local",
      api: "http://127.0.0.1:55421",
      database_port: 55422,
      frontend: "http://localhost:3001",
      production_config_unchanged: true,
      migrationChanges,
      seed_adjustments: [
        "Existing rulebook seeded before dependent migrations",
        "Final seed conflict target matches versioned rules index",
        "Seal synthetic demo reports using the existing trusted function after seeding",
      ],
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    local_project: target,
    project_id: "saleem-gemini-local",
    api: "http://127.0.0.1:55421",
    credential_written: true,
    model,
    migrationChanges,
  }),
);
