import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
// Loaded lazily so the first paint never waits for the Supabase client bundle.
const sb = () => import("@/lib/supabase").then((m) => m.supabase);

/**
 * Demo personas (seeded by `npm run demo:seed` into the isolated org «بنك سليم التجريبي»). Shown on the sign-in page
 * ONLY in a demo build: VITE_DEMO_MODE=true AND VITE_DEMO_PASSWORD set at build time (git-ignored .env.local). A
 * production build has neither, so no shared credential is ever shipped. No password is hard-coded here.
 */
const DEMO_PASSWORD = (import.meta.env["VITE_DEMO_PASSWORD"] as string | undefined) ?? "";
export const DEMO_LOGINS =
  import.meta.env["VITE_DEMO_MODE"] === "true" && DEMO_PASSWORD.length >= 8;
export const DEMO_PERSONAS = [
  { key: "marketer", email: "marketer@demo.saleem.app" },
  { key: "lead", email: "lead@demo.saleem.app" },
  { key: "admin", email: "admin@demo.saleem.app" },
  { key: "partner", email: "partner@demo.saleem.app" },
  { key: "viewer", email: "viewer@demo.saleem.app" },
] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];
export async function signInAsPersona(p: DemoPersona) {
  if (!DEMO_LOGINS) throw new Error("demo logins are disabled in this build");
  await signIn(p.email, DEMO_PASSWORD);
}

interface AuthState {
  session: Session | null;
  user: User | null;
  /** False until the persisted session has been read. */
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, user: null, ready: false });

/** Resolves once the persisted session is known — used by route guards. */
export async function getSession(): Promise<Session | null> {
  const { data } = await (await sb()).auth.getSession();
  return data.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, ready: false });
  useEffect(() => {
    let unsubscribe = () => {};
    let alive = true;
    void sb().then((client) => {
      if (!alive) return;
      void client.auth.getSession().then(({ data }) => {
        if (alive)
          setState({ session: data.session, user: data.session?.user ?? null, ready: true });
      });
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        setState({ session, user: session?.user ?? null, ready: true }),
      );
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export type AuthErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "userExists"
  | "weakPassword"
  | "rateLimited"
  | "demoUnavailable"
  | "generic";

/** Maps Supabase auth errors to translatable keys (never show raw server text). */
export function authErrorKey(err: unknown): AuthErrorKey {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("invalid login")) return "invalidCredentials";
  if (msg.includes("not confirmed")) return "emailNotConfirmed";
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "userExists";
  if (msg.includes("password")) return "weakPassword";
  if (msg.includes("rate") || msg.includes("too many")) return "rateLimited";
  return "generic";
}

export async function signIn(email: string, password: string) {
  const { error } = await (await sb()).auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await (
    await sb()
  ).auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${window.location.origin}/dashboard`,
    },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string) {
  const { error } = await (
    await sb()
  ).auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await (await sb()).auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await (await sb()).auth.signOut();
}
