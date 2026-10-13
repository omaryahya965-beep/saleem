import { redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/api/auth";

/** beforeLoad guard: redirects to /login (keeping the target) when signed out. */
export async function requireAuth({ location }: { location: { href: string } }) {
  const session = await getSession();
  if (!session) throw redirect({ to: "/login", search: { redirect: location.href } });
  return { session };
}

/** beforeLoad guard for auth pages: signed-in users go straight to their dashboard. */
export async function redirectIfAuthed() {
  const session = await getSession();
  if (session) throw redirect({ to: "/dashboard" });
}
