import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "@/features/enterprise/AnalyticsPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/analytics")({
  beforeLoad: requireAuth,
  component: AnalyticsPage,
});
