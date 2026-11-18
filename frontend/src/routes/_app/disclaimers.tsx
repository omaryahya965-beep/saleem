import { createFileRoute } from "@tanstack/react-router";
import { DisclaimersPage } from "@/features/libraries/DisclaimersPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/disclaimers")({
  beforeLoad: requireAuth,
  component: DisclaimersPage,
});
