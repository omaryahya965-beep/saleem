import { createFileRoute } from "@tanstack/react-router";
import { FixPage } from "@/features/fix/FixPage";

// SALEEM Fix (D178). The server decides access (can_fix_promotion, RLS on correction_jobs).
export const Route = createFileRoute("/_app/promotions/$id_/fix")({
  component: function FixRoute() {
    const { id } = Route.useParams();
    return <FixPage key={id} id={id} />;
  },
});
