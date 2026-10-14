import { createFileRoute } from "@tanstack/react-router";
import { CampaignPage } from "@/features/org/OrgPages";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/org/$id/campaigns/$cid")({
  beforeLoad: requireAuth,
  component: function CampaignRoute() {
    const { id, cid } = Route.useParams();
    return <CampaignPage id={id} cid={cid} />;
  },
});
