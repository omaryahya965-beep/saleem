import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
// Loaded lazily so the first paint never waits for the Supabase client bundle.
const sb = () => import("@/lib/supabase").then((m) => m.supabase);

/**
 * One-click demo (all nine roles). No credential is in the client: the `demo-login` edge function (enabled only by
 * the SERVER secret DEMO_MODE=true in a demo environment) returns a one-time token that is exchanged for a session.
 * VITE_DEMO_LOGIN only shows the UI; it is not a secret and grants nothing by itself.
 */
// Opt-in: default to enabled unless explicitly set to false.
export const DEMO_LOGINS = import.meta.env["VITE_DEMO_LOGIN"] !== "false";
export const ESSENTIAL_PERSONAS = ["admin", "creator", "reviewer", "external_uploader"] as const;

export const ADVANCED_PERSONAS = [
  "owner",
  "compliance_lead",
  "legal",
  "external_reviewer",
  "viewer",
] as const;

export const DEMO_PERSONAS = [...ESSENTIAL_PERSONAS, ...ADVANCED_PERSONAS] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];

export const DEMO_EMAILS: Record<DemoPersona, string> = {
  owner: "owner@demo.saleem.app",
  admin: "orgadmin@demo.saleem.app",
  compliance_lead: "lead@demo.saleem.app",
  reviewer: "reviewer@demo.saleem.app",
  legal: "legal@demo.saleem.app",
  creator: "marketer@demo.saleem.app",
  external_uploader: "partner@demo.saleem.app",
  external_reviewer: "extreviewer@demo.saleem.app",
  viewer: "viewer@demo.saleem.app",
};
/** D211: the individual / content-creator demo — a personal workspace only (no organisation, no role). */
export const INDIVIDUAL_DEMO = "individual" as const;

export async function signInAsPersona(persona: DemoPersona | typeof INDIVIDUAL_DEMO) {
  const client = await sb();
  const { data, error } = await client.functions.invoke("demo-login", { body: { persona } });
  if (error || !data?.token_hash) {
    let errorCode: string | undefined = (data as { error?: string } | null)?.error;
    if (!errorCode && error && typeof error === "object" && "context" in error) {
      try {
        const body = await (error as { context: Response }).context.json();
        errorCode = body?.error;
      } catch {
        // ignore context parse error
      }
    }
    throw new Error(errorCode ?? error?.message ?? "demo_failed");
  }
  const { error: otpErr } = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.token_hash as string,
  });
  if (otpErr) throw otpErr;
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

/** How the new user means to use SALEEM (D211). Stored as a preference only: it grants nothing. */
export type AccountIntent = "personal" | "organization";

export async function signUp(
  email: string,
  password: string,
  displayName: string,
  intent: AccountIntent = "personal",
) {
  const { data, error } = await (
    await sb()
  ).auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, account_intent: intent },
      emailRedirectTo: `${window.location.origin}/welcome`,
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
