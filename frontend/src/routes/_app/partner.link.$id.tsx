import { createFileRoute } from "@tanstack/react-router";
import { PartnerPage } from "@/features/enterprise/PartnerPage";

// D174: an assigned partner link opened from inside the account (no token; membership + assignment are checked
// by partner_link_info_by_id / partner_create_promotion_v2).
export const Route = createFileRoute("/_app/partner/link/$id")({
  component: function PartnerLinkRoute() {
    const { id } = Route.useParams();
    return <PartnerPage token={`link:${id}`} />;
  },
});
