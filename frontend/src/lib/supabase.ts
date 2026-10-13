import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** True when the public Supabase env is missing — the UI shows a setup error instead of failing silently. */
export const isSupabaseConfigured = Boolean(url && key);

export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const supabase = createClient<Database>(
  url || "http://127.0.0.1:54321",
  key || "missing-publishable-key",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);
