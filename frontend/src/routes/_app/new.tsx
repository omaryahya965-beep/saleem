import { createFileRoute } from "@tanstack/react-router";
import { NewCheckPage } from "@/features/submissions/NewCheckPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/new")({
  beforeLoad: requireAuth,
  validateSearch: (s: Record<string, unknown>): { parent?: string } => ({
    parent: typeof s["parent"] === "string" ? s["parent"] : undefined,
  }),
  component: NewCheckPage,
});
