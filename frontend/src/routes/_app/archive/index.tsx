import { createFileRoute } from "@tanstack/react-router";
import { ArchivePage } from "@/features/archive/ArchivePages";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/archive/")({
  beforeLoad: requireAuth,
  component: ArchivePage,
});
