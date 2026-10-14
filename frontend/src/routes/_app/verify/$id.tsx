import { createFileRoute } from "@tanstack/react-router";
import { VerifyPage } from "@/features/verify/VerifyPage";

// Public verification of a compliance log (minimal, non-identifying facts).
export const Route = createFileRoute("/_app/verify/$id")({
  component: function VerifyRoute() {
    const { id } = Route.useParams();
    return <VerifyPage id={id} />;
  },
});
