import { createFileRoute } from "@tanstack/react-router";
import { RulebookAdminPage } from "@/features/admin/RulebookAdminPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/admin/rules")({
  beforeLoad: requireAuth,
  component: RulebookAdminPage,
});
