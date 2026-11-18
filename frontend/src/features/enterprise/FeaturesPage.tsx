import { Settings2 } from "lucide-react";
import { EmptyState, Page, PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { FeatureFlagsCard } from "./FeatureFlagsCard";

/** /features — «الميزات»: owners and admins turn each workflow on or off for their organisation. */
export function FeaturesPage() {
  const { t } = useI18n();
  const picker = useOrgPicker();
  const manager = ["owner", "admin"].includes(picker.role ?? "");
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("flags.pageTitle")} description={t("flags.subtitle")} />
      <OrgSelect picker={picker} />
      {manager && picker.orgId ? (
        <FeatureFlagsCard orgId={picker.orgId} />
      ) : (
        <EmptyState icon={<Settings2 />} title={t("flags.managersOnly")} />
      )}
    </Page>
  );
}
