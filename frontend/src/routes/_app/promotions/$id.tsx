import { createFileRoute } from "@tanstack/react-router";
import { PromotionPage } from "@/features/promotions/PromotionPage";

// Public route: RLS decides visibility (own/org promotions, or is_demo samples).
export const Route = createFileRoute("/_app/promotions/$id")({
  validateSearch: (s: Record<string, unknown>): { v?: number } => {
    const v = Number(s["v"]);
    return { v: Number.isInteger(v) && v >= 1 ? v : undefined };
  },
  component: function PromotionRoute() {
    const { id } = Route.useParams();
    const { v } = Route.useSearch();
    return <PromotionPage key={id} id={id} v={v} />;
  },
});
