import { createFileRoute } from "@tanstack/react-router";
import { RulebookPage } from "@/features/rulebook/RulebookPage";

export const Route = createFileRoute("/_app/rules")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
  }),
  component: RulebookPage,
});
