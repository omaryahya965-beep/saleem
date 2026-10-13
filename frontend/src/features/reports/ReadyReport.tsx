import { Check, ChevronLeft } from "lucide-react";
import { StatusChip } from "@/components/StatusChip";
import type { IssueItem } from "@/lib/api/types";
import type { Screen } from "@/types/app";

export function ReadyReport({
  go,
  issues,
  onPrevious,
}: {
  go: (s: Screen) => void;
  issues: IssueItem[];
  onPrevious: () => void;
}) {
  return (
    <section className="ready-content">
      <h2>ما تم إصلاحه مقارنة بالنسخة السابقة</h2>
      <ul>
        {issues.map((x, i) => (
          <li key={`${x.id}-${i}`}>
            <Check />
            <span>{x.title}</span>
            <StatusChip type="ok">تم</StatusChip>
          </li>
        ))}
      </ul>
      <button className="previous" onClick={onPrevious}>
        <ChevronLeft /> النسخة السابقة: يحتاج تعديلات، 5 ملاحظات
      </button>
    </section>
  );
}
