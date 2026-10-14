import { createFileRoute } from "@tanstack/react-router";
import { ArchiveBatchPage } from "@/features/archive/ArchivePages";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/archive/$id")({
  beforeLoad: requireAuth,
  component: function ArchiveBatchRoute() {
    const { id } = Route.useParams();
    return <ArchiveBatchPage id={id} />;
  },
});
