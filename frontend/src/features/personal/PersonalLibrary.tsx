import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, FileSearch, Search, Sparkles, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Page,
  PageHeader,
  SegmentedControl,
  Skeleton,
  StatusChip,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { listPromotions } from "@/lib/api/promotions";
import { archivePromotion } from "@/lib/api/review";
import { personalResult } from "./PersonalDashboard";

type Filter = "all" | "needs_fixes" | "ready" | "pending" | "archived";

/**
 * D211 «إعلاناتي»: the individual's own advertisements (RLS: owner only, org_id is null) with their automated
 * result, quick actions (open, smart correction) and archiving. Versions, original media, corrected and generated
 * videos and the analysis history open from each advertisement.
 */
export function PersonalLibrary() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["personal", "promotions"],
    queryFn: () => listPromotions({ personal: true }),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archivePromotion(id, t("library.archiveReason")),
    onSuccess: () => {
      toast.success(t("library.archived"));
      void qc.invalidateQueries({ queryKey: ["personal"] });
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (list.data ?? []).filter((p) => {
      if (term && !p.title.toLowerCase().includes(term)) return false;
      const archived = p.review_status === "archived";
      if (filter === "archived") return archived;
      if (archived) return false;
      const r = personalResult(p).key;
      if (filter === "needs_fixes") return r === "needs_fixes" || r === "review";
      if (filter === "ready") return r === "ready";
      if (filter === "pending") return r === "none" || r === "running" || r === "failed";
      return true;
    });
  }, [list.data, filter, q]);
  const date = (s: string) =>
    new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("appNav.personal.promotions")}
        description={t("library.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" icon={<Wand2 />}>
              <Link to="/studio">{t("personal.action.create")}</Link>
            </Button>
            <Button asChild icon={<FileSearch />}>
              <Link to="/new">{t("personal.action.check")}</Link>
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label={t("library.filter")}
          value={filter}
          onValueChange={setFilter}
          options={(["all", "needs_fixes", "ready", "pending", "archived"] as const).map((k) => ({
            value: k,
            label: t(`library.f.${k}` as TKey),
          }))}
        />
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">{t("library.search")}</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-fg-muted ltr:left-3 rtl:right-3"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("library.search")}
            className="ps-9"
            dir="auto"
          />
        </label>
      </div>

      {list.isPending ? (
        <Skeleton className="h-64" />
      ) : list.isError ? (
        <ErrorState title={t("errors.generic")} onRetry={() => void list.refetch()} />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<FileSearch />}
          title={t("library.empty")}
          body={t("personal.emptyAds")}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="personal-library">
          {shown.map((p) => {
            const r = personalResult(p);
            const archived = p.review_status === "archived";
            return (
              <li key={p.id}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/promotions/$id"
                      params={{ id: p.id }}
                      className="min-w-0 font-bold hover:text-green"
                      dir="auto"
                    >
                      <span className="line-clamp-2">{p.title}</span>
                    </Link>
                    <StatusChip tone={archived ? "neutral" : r.tone} size="sm">
                      {archived ? t("library.f.archived") : t(`personal.result.${r.key}` as TKey)}
                    </StatusChip>
                  </div>
                  <p className="text-xs text-fg-muted">
                    {t("personal.version", { n: p.current?.version_no ?? 1 })} ·{" "}
                    {p.current ? t(`kinds.${p.current.kind}` as TKey) : "—"} · {date(p.updated_at)}
                  </p>
                  <div className="mt-auto flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/promotions/$id" params={{ id: p.id }}>
                        {t("library.open")}
                      </Link>
                    </Button>
                    {!archived && p.current?.status === "done" && r.key !== "ready" && (
                      <Button asChild size="sm" variant="secondary" icon={<Sparkles />}>
                        <Link to="/promotions/$id/fix" params={{ id: p.id }}>
                          {t("personal.action.fix")}
                        </Link>
                      </Button>
                    )}
                    {!archived && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Archive />}
                        loading={archive.isPending && archive.variables === p.id}
                        onClick={() => {
                          if (window.confirm(t("library.archiveConfirm"))) archive.mutate(p.id);
                        }}
                      >
                        {t("library.archive")}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
