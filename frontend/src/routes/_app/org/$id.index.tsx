import { createFileRoute } from "@tanstack/react-router";
import { OrgPage } from "@/features/org/OrgPages";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/org/$id/")({
  beforeLoad: requireAuth,
  component: function OrgRoute() {
    const { id } = Route.useParams();
    return <OrgPage key={id} id={id} />;
  },
});
