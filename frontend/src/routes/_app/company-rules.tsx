import { createFileRoute } from "@tanstack/react-router";
import { CompanyRulesPage } from "@/features/enterprise/CompanyRulesPage";
import { requireAuth } from "@/lib/guards";

export const Route = createFileRoute("/_app/company-rules")({
  beforeLoad: requireAuth,
  component: CompanyRulesPage,
});
