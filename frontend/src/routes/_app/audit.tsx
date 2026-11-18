import { createFileRoute } from "@tanstack/react-router";
import { AuditPage } from "@/features/review/AuditPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/audit")({
  beforeLoad: requireAuth,
  component: AuditPage,
});
