import { createFileRoute } from "@tanstack/react-router";
import { ClaimsPage } from "@/features/libraries/ClaimsPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/claims")({
  beforeLoad: requireAuth,
  component: ClaimsPage,
});
