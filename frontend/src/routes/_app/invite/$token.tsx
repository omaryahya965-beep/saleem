import { createFileRoute } from "@tanstack/react-router";
import { InvitePage } from "@/features/org/OrgPages";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/invite/$token")({
  beforeLoad: requireAuth,
  component: function InviteRoute() {
    const { token } = Route.useParams();
    return <InvitePage token={token} />;
  },
});
