import { createFileRoute } from "@tanstack/react-router";
import { EvalPage } from "@/features/admin/EvalPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/admin/eval")({
  beforeLoad: requireAuth,
  component: EvalPage,
});
