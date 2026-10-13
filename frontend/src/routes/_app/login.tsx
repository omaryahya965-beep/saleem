import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/AuthPages";
import { redirectIfAuthed } from "@/lib/guards";

export const Route = createFileRoute("/_app/login")({
  beforeLoad: redirectIfAuthed,
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect:
      typeof s["redirect"] === "string" && s["redirect"].startsWith("/")
        ? s["redirect"]
        : undefined,
  }),
  component: LoginPage,
});
