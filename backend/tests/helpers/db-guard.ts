// D214: backend tests may only ever touch the ISOLATED test stack (scripts/isolated-stack.mjs, project saleem_iso,
// ports 544xx). Loaded by vitest before every test file (vitest.config.ts setupFiles).
//
// - Database settings come from the process environment only — never from backend/.env or any other file (the
//   user's backend/.env points SUPABASE_LOCAL_URL at the DEVELOPMENT database, which a test once wrote to).
// - If ANY database target is present and it is not the authorised isolated stack, the whole run fails immediately.
// - Database suites run only under `node scripts/isolated-stack.mjs run -- …` (it sets SALEEM_ISO=1 and the 544xx
//   URL/keys); otherwise they are skipped without connecting anywhere.
// - The former «live» mode (VITE_SUPABASE_URL + TEST_USER_* credentials, which could reach a hosted project) is gone.

const ISO_URL = /^http:\/\/(127\.0\.0\.1|localhost):544\d\d\/?$/;
const TARGET_KEYS = ["SUPABASE_LOCAL_URL", "SUPABASE_URL", "TEST_SUPABASE_URL"] as const;

export class TestTargetError extends Error {}

/** Throws when the environment names a database that is not the isolated test stack. */
export function assertIsolatedTarget(env: Record<string, string | undefined> = process.env): void {
  for (const k of TARGET_KEYS) {
    const v = env[k];
    if (!v) continue;
    if (!ISO_URL.test(v))
      throw new TestTargetError(
        `refusing to run tests: ${k}=${v} is not the isolated test stack (http://127.0.0.1:544xx). ` +
          "Run database tests with `node scripts/isolated-stack.mjs run -- npm --workspace backend test`.",
      );
    if (env["SALEEM_ISO"] !== "1")
      throw new TestTargetError(`refusing to run tests: ${k} is set but SALEEM_ISO=1 is not (use scripts/isolated-stack.mjs run).`);
  }
}

export interface IsolatedDb {
  url: string;
  anonKey: string;
  serviceKey: string;
}

/** The isolated stack's connection, or null (database suites skip) when not running under isolated-stack.mjs. */
export function isolatedDb(env: Record<string, string | undefined> = process.env): IsolatedDb | null {
  assertIsolatedTarget(env);
  const url = env["SUPABASE_LOCAL_URL"];
  const anonKey = env["SUPABASE_LOCAL_ANON_KEY"];
  const serviceKey = env["SUPABASE_LOCAL_SERVICE_ROLE_KEY"];
  if (env["SALEEM_ISO"] !== "1" || !url || !anonKey || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey, serviceKey };
}

// Setup-file side effect: fail the run before any test file connects anywhere.
assertIsolatedTarget();
