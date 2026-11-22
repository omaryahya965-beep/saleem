import { createFileRoute } from "@tanstack/react-router";
import { WelcomePage } from "@/features/auth/WelcomePage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/welcome")({
  beforeLoad: requireAuth,
  component: WelcomePage,
});
