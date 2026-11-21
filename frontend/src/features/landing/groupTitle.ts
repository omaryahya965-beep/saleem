import { useI18n, type TKey } from "@/i18n";
import type { FindingGroup } from "@/features/reports/grouping";

/** Title of a consolidated group: the claim facet when there is one, else the finding's explanation. */
export function useGroupTitle() {
  const { t, lang } = useI18n();
  return (g: FindingGroup) => {
    if (g.facet) return t(`ws.facet.${g.facet}` as TKey);
    const f = g.members[0]!;
    return (lang === "en" ? f.explanation_en : f.explanation_ar) ?? g.ruleCode;
  };
}
