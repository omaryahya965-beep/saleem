import type { Dispatch, SetStateAction } from "react";
import { Checkbox, Field, Input } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { RejectionReason } from "@/lib/api/review";

/**
 * The organisation's rejection reasons as checkboxes, plus a free-text reason when «other» is picked or nothing is.
 * Shared by the review decision dialog and the approval-flow step decision.
 */
export function RejectionReasonsField({
  reasons,
  picked,
  setPicked,
  other,
  setOther,
}: {
  reasons: RejectionReason[];
  picked: string[];
  setPicked: Dispatch<SetStateAction<string[]>>;
  other: string;
  setOther: (v: string) => void;
}) {
  const { t, lang } = useI18n();
  const otherPicked = reasons.some((r) => r.is_other && picked.includes(r.id));
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{t("review.reasons")}</legend>
      {reasons.map((r) => (
        <Checkbox
          key={r.id}
          label={lang === "en" ? r.label_en : r.label_ar}
          checked={picked.includes(r.id)}
          onChange={(e) =>
            setPicked((x) => (e.target.checked ? [...x, r.id] : x.filter((y) => y !== r.id)))
          }
        />
      ))}
      {(otherPicked || !picked.length) && (
        <Field label={t("review.reasonOther")} className="mt-2">
          <Input value={other} onChange={(e) => setOther(e.target.value)} dir="auto" />
        </Field>
      )}
    </fieldset>
  );
}
