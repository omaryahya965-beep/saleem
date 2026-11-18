import { Field, Select } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { OrgPicker } from "./orgPicker";

export function OrgSelect({ picker }: { picker: OrgPicker }) {
  const { t } = useI18n();
  if ((picker.orgs.data?.length ?? 0) < 2) return null;
  return (
    <Field label={t("products.pickOrg")} className="max-w-sm">
      <Select value={picker.orgId} onChange={(e) => picker.setOrgId(e.target.value)}>
        {picker.orgs.data!.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}
