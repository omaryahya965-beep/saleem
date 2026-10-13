import { createFileRoute } from "@tanstack/react-router";
import { CheckPage } from "@/features/reports/CheckPage";

// Public route: RLS decides visibility (own checks, or is_demo sample reports).
export const Route = createFileRoute("/_app/checks/$id")({
  component: function CheckRoute() {
    const { id } = Route.useParams();
    return <CheckPage key={id} id={id} />;
  },
});
