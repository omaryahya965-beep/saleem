import { createFileRoute } from "@tanstack/react-router";
import { RulebookPage } from "@/features/rulebook/RulebookPage";

export const Route = createFileRoute("/_app/rules")({ component: RulebookPage });
