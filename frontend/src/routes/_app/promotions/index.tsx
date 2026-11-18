import { createFileRoute } from "@tanstack/react-router";
import { PromotionsListPage } from "@/features/promotions/PromotionsListPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/promotions/")({
  beforeLoad: requireAuth,
  validateSearch: (s: Record<string, unknown>): { status?: string } => ({
    status: typeof s["status"] === "string" ? s["status"] : undefined,
  }),
  component: PromotionsListPage,
});
