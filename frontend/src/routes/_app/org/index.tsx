import { createFileRoute } from "@tanstack/react-router";
import { OrgsPage } from "@/features/org/OrgPages";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/org/")({
  beforeLoad: requireAuth,
  component: OrgsPage,
});
