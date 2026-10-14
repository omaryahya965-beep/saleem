import { createFileRoute } from "@tanstack/react-router";
import { SharePage } from "@/features/share/SharePages";

// Public: access is controlled by the unguessable, expiring token (checked in get_shared_report).
export const Route = createFileRoute("/_app/share/$token")({
  component: function ShareRoute() {
    const { token } = Route.useParams();
    return <SharePage token={token} />;
  },
});
