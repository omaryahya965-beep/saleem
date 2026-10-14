import { createFileRoute } from "@tanstack/react-router";
import { NewCheckPage } from "@/features/submissions/NewCheckPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/new")({
  beforeLoad: requireAuth,
  validateSearch: (
    s: Record<string, unknown>,
  ): { parent?: string; org?: string; campaign?: string } => ({
    parent: typeof s["parent"] === "string" ? s["parent"] : undefined,
    org: typeof s["org"] === "string" ? s["org"] : undefined,
    campaign: typeof s["campaign"] === "string" ? s["campaign"] : undefined,
  }),
  component: NewCheckPage,
});
