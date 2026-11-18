import { createFileRoute } from "@tanstack/react-router";
import { FeaturesPage } from "@/features/enterprise/FeaturesPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/features")({
  beforeLoad: requireAuth,
  component: FeaturesPage,
});
