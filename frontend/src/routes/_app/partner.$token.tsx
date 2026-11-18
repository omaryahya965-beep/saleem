import { createFileRoute } from "@tanstack/react-router";
import { PartnerPage } from "@/features/enterprise/PartnerPage";

// Public entry: the link token is checked in partner_link_info; submitting requires an email-code sign-in.
export const Route = createFileRoute("/_app/partner/$token")({
  component: function PartnerRoute() {
    const { token } = Route.useParams();
    return <PartnerPage token={token} />;
  },
});
