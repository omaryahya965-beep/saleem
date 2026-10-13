import { createFileRoute } from "@tanstack/react-router";
import { LogPage } from "@/features/compliance-log/LogPage";

export const Route = createFileRoute("/_app/checks_/$id/log")({
  component: function LogRoute() {
    const { id } = Route.useParams();
    return <LogPage id={id} />;
  },
});
