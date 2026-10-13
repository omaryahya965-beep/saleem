import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/features/submissions/DashboardPage";
import type { DashboardFilter } from "@/lib/api/data";
import { requireAuth } from "@/lib/guards";

const FILTERS: DashboardFilter[] = [
  "all",
  "needs_fixes",
  "review",
  "ready",
  "processing",
  "failed",
];

export const Route = createFileRoute("/_app/dashboard")({
  beforeLoad: requireAuth,
  validateSearch: (
    s: Record<string, unknown>,
  ): { status?: DashboardFilter; q?: string; page?: number } => ({
    status: FILTERS.includes(s["status"] as DashboardFilter)
      ? (s["status"] as DashboardFilter)
      : undefined,
    q: typeof s["q"] === "string" && s["q"] ? s["q"] : undefined,
    page: Number(s["page"]) > 1 ? Number(s["page"]) : undefined,
  }),
  component: DashboardPage,
});
