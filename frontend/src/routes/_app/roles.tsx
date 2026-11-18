import { createFileRoute } from "@tanstack/react-router";
import { RolesPage } from "@/features/roles/RolesPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/roles")({
  beforeLoad: requireAuth,
  component: RolesPage,
});
