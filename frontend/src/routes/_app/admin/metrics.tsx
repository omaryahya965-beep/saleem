import { createFileRoute } from "@tanstack/react-router";
import { MetricsPage } from "@/features/admin/MetricsPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/admin/metrics")({
  beforeLoad: requireAuth,
  component: MetricsPage,
});
