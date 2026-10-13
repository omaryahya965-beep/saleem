import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/settings")({
  beforeLoad: requireAuth,
  component: SettingsPage,
});
