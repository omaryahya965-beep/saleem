import { createFileRoute } from "@tanstack/react-router";
import { AskPage } from "@/features/enterprise/AskPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/ask")({
  beforeLoad: requireAuth,
  component: AskPage,
});
