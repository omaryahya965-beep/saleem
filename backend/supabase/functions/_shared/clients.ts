// Supabase clients for the Edge Functions: one place for the project URL, the keys and the client options.
// (Kept out of http.ts, which the Node unit tests import without a Deno/esm.sh resolver.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const env = (k: string) => Deno.env.get(k)!;

/** Service-role client. It bypasses RLS: use it only after the caller's rights have been checked. */
export const serviceClient = () =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

/** Client acting as the caller (RLS applies), from the caller's bearer token. */
export const userClient = (token: string) =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
