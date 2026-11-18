import { createFileRoute } from "@tanstack/react-router";
import { RulebookPage } from "@/features/rulebook/RulebookPage";

export const Route = createFileRoute("/_app/rules")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: RulebookPage,
});
