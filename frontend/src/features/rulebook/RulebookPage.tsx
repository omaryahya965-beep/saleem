import { Info, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Page,
  PageHeader,
  RuleRow,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { useRulebook } from "@/lib/api/hooks";
import type { Rule } from "@/lib/api/data";

const CATS = ["mawthooq", "content", "ai", "commerce"] as const;
type Cat = (typeof CATS)[number] | "all";

export function RulebookPage() {
  const { t, lang } = useI18n();
  const book = useRulebook();
  const [cat, setCat] = useState<Cat>("all");
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (r: Rule) =>
      !term ||
      [r.code, r.title_ar, r.title_en, r.description_ar, r.description_en, r.source_name].some(
        (x) => x.toLowerCase().includes(term),
      );
    const rules = (book.data?.rules ?? []).filter(
      (r) => (cat === "all" || r.category === cat) && match(r),
    );
    return CATS.map((c) => ({ cat: c, rules: rules.filter((r) => r.category === c) })).filter(
      (g) => g.rules.length,
    );
  }, [book.data, cat, q]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of book.data?.rules ?? []) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return m;
  }, [book.data]);

  const version = book.data?.version?.version_label;
  const illustrative = /illustrative|توضيحية/i.test(book.data?.version?.notes ?? "");

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("rulebook.title")}
        description={t("rulebook.subtitle")}
        eyebrow={
          version && (
            <span className="flex flex-wrap gap-2">
              <Badge variant="green">{t("rulebook.version", { v: version })}</Badge>
              {illustrative && <Badge variant="outline">{t("rulebook.illustrative")}</Badge>}
            </span>
          )
        }
      />

      <p className="flex items-start gap-3 rounded-md border border-amber/25 bg-amber-bg px-4 py-3 text-sm text-fg">
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-text" />
        {t("rulebook.illustrativeBody")}
      </p>

      <div className="flex flex-col gap-3">
        <label className="relative block max-w-md">
          <span className="sr-only">{t("rulebook.searchLabel")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3.5 top-1/2 size-4.5 -translate-y-1/2 text-fg-muted"
          />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("rulebook.searchPlaceholder")}
            className="ps-10"
          />
        </label>
        <Tabs value={cat} onValueChange={(v) => setCat(v as Cat)}>
          <TabsList label={t("rulebook.categoriesLabel")}>
            <TabsTrigger value="all" count={book.data?.rules.length}>
              {t("common.all")}
            </TabsTrigger>
            {CATS.map((c) => (
              <TabsTrigger key={c} value={c} count={counts.get(c) ?? 0}>
                {t(`ruleCategories.${c}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {book.isError ? (
        <ErrorState
          title={t("rulebook.loadError")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void book.refetch()}
        />
      ) : book.isPending ? (
        <Card className="flex flex-col gap-5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-6 w-16" />
              <span className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </span>
            </div>
          ))}
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState icon={<SearchX />} title={t("rulebook.noResults")} />
      ) : (
        groups.map((g) => (
          <section key={g.cat} aria-labelledby={`cat-${g.cat}`} className="flex flex-col gap-2">
            <h2 id={`cat-${g.cat}`} className="text-lg font-bold">
              {t(`ruleCategories.${g.cat}`)}
            </h2>
            <Card className="py-1 sm:py-1">
              {g.rules.map((r) => (
                <RuleRow
                  key={r.code}
                  code={r.code}
                  title={lang === "en" ? r.title_en : r.title_ar}
                  description={lang === "en" ? r.description_en : r.description_ar}
                  sourceName={(lang === "en" ? r.source_name_en : null) || r.source_name}
                  sourceUrl={r.source_url || null}
                  version={version}
                  severity={r.default_severity}
                  illustrative={illustrative}
                  illustrativeLabel={t("rulebook.illustrativeShort")}
                />
              ))}
            </Card>
          </section>
        ))
      )}
    </Page>
  );
}
