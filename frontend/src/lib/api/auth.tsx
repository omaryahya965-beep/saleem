import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export const DEMO_EMAIL = "demo@saleem.app";
export const DEMO_PASSWORD = "demo123456";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** False until the persisted session has been read. */
  ready: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, user: null, ready: false });

/** Resolves once the persisted session is known — used by route guards. */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, user: null, ready: false });
  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) =>
        setState({ session: data.session, user: data.session?.user ?? null, ready: true }),
      );
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ session, user: session?.user ?? null, ready: true }),
    );
    return () => data.subscription.unsubscribe();
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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signInDemo() {
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) throw Object.assign(new Error(error.message), { demo: true });
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
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
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
