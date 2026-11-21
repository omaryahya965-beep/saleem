// Company rules: likely duplicates of a proposal (D196) — a warning only; saving is never blocked and nothing is
// replaced. Approval of a draft that repeats an ACTIVE rule is refused by the server (approve_internal_rule).
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";

interface Dup {
  id: string;
  code: string;
  title_ar: string;
  status: string;
  similarity: number;
}

export function DuplicateWarning({
  orgId,
  title,
  instruction,
  exclude,
}: {
  orgId: string;
  title: string;
  instruction: string;
  exclude?: string | null;
}) {
  const { t } = useI18n();
  const [debounced, setDebounced] = useState({ title, instruction });
  useEffect(() => {
    const h = setTimeout(() => setDebounced({ title, instruction }), 500);
    return () => clearTimeout(h);
  }, [title, instruction]);
  const q = useQuery({
    queryKey: ["rule-dups", orgId, debounced, exclude],
    enabled: debounced.instruction.trim().length > 8 || debounced.title.trim().length > 3,
    queryFn: async () =>
      ((
        await (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)(
          "internal_rule_duplicates",
          {
            _org: orgId,
            _title: debounced.title,
            _instruction: debounced.instruction,
            _exclude: exclude ?? null,
          },
        )
      ).data ?? []) as Dup[],
  });
  if (!q.data?.length) return null;
  return (
    <div
      role="status"
      data-testid="rule-duplicates"
      className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm"
    >
      <p className="font-bold text-amber-text">{t("rules2.dupTitle")}</p>
      <ul className="mt-1 list-inside list-disc">
        {q.data.map((d) => (
          <li key={d.id}>
            <bdi>{d.code}</bdi> — {d.title_ar} ({t(`internalRules.status.${d.status}` as TKey)},{" "}
            {Math.round(d.similarity * 100)}٪)
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs">{t("rules2.dupHint")}</p>
    </div>
  );
}
