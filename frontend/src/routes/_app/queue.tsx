import { createFileRoute } from "@tanstack/react-router";
import { QueuePage } from "@/features/review/QueuePage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/queue")({
  beforeLoad: requireAuth,
  component: QueuePage,
});
