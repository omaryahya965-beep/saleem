import { createFileRoute } from "@tanstack/react-router";
import { PromotionPage } from "@/features/promotions/PromotionPage";

// Public route: RLS decides visibility (own/org promotions, or is_demo samples).
export const Route = createFileRoute("/_app/promotions/$id")({
  validateSearch: (s: Record<string, unknown>): { v?: number; t?: number } => {
    const v = Number(s["v"]);
    const t = Number(s["t"]);
    return {
      v: Number.isInteger(v) && v >= 1 ? v : undefined,
      t: Number.isFinite(t) && t >= 0 ? t : undefined,
    };
  },
  component: function PromotionRoute() {
    const { id } = Route.useParams();
    const { v, t } = Route.useSearch();
    return <PromotionPage key={id} id={id} v={v} t={t} />;
  },
});
