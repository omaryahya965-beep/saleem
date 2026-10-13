import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "@/features/auth/AuthPages";
import { redirectIfAuthed } from "@/lib/guards";

export const Route = createFileRoute("/_app/signup")({
  beforeLoad: redirectIfAuthed,
  component: SignupPage,
});
