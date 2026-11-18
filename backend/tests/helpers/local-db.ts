// Helpers for database tests against a LOCAL Supabase stack (`npx supabase start --workdir backend`).
// Enabled only when these are set (values from `npx supabase status --workdir backend`):
//   SUPABASE_LOCAL_URL (must be http://127.0.0.1:… or http://localhost:…)
//   SUPABASE_LOCAL_ANON_KEY, SUPABASE_LOCAL_SERVICE_ROLE_KEY
// Never point these at the hosted project: the guard below refuses non-local URLs.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "../../eval/lib.ts";

export interface LocalDb {
  url: string;
  anonKey: string;
  admin: SupabaseClient;
}

export interface TestUser {
  db: SupabaseClient;
  id: string;
  email: string;
}

const env = loadEnv();

export function isLocalUrl(url: string | undefined): boolean {
  return Boolean(url && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url));
}

export function localDb(): LocalDb | null {
  const url = env("SUPABASE_LOCAL_URL");
  const anonKey = env("SUPABASE_LOCAL_ANON_KEY");
  const serviceKey = env("SUPABASE_LOCAL_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey || !isLocalUrl(url)) return null;
  return { url, anonKey, admin: createClient(url, serviceKey, { auth: { persistSession: false } }) };
}

/** Creates a confirmed user with a random email and returns a client signed in as that user. */
export async function createUser(local: LocalDb, label: string): Promise<TestUser> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@test.local`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data, error } = await local.admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const db = createClient(local.url, local.anonKey, { auth: { persistSession: false } });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { db, id: data.user.id, email };
}
