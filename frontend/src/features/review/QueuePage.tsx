import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";
import { fetchQueue, isOverdue, rk } from "@/lib/api/review";
import { filterQueue, type QueueTab as Tab } from "./model";

/** /queue — promotions waiting for a review decision (05_UX_SPEC §3). */
export function QueuePage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("mine");
  const queue = useQuery({ queryKey: rk.queue, queryFn: fetchQueue });
  const orgIds = [
    ...new Set((queue.data ?? []).map((p) => p.org_id).filter((x): x is string => Boolean(x))),
  ];
  const settings = useQuery({
    queryKey: ["queue-sla", orgIds],
    enabled: orgIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("org_settings")
          .select("org_id, review_sla_business_days, weekend_days")
          .in("org_id", orgIds)
      ).data ?? [],
  });
  const sla = new Map((settings.data ?? []).map((s) => [s.org_id, s]));
  const items = filterQueue(queue.data ?? [], tab, user?.id ?? null);
  const date = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")
      : "—";

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("review.queue.title")} description={t("review.queue.subtitle")} />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList label={t("review.queue.title")}>
          {(["mine", "unassigned", "escalation", "all"] as const).map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`review.queue.${k}` as TKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {queue.isPending ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : queue.isError ? (
        <ErrorState
          title={t("review.queue.title")}
          body={t("errors.network")}
          retryLabel={t("common.retry")}
          onRetry={() => void queue.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("review.queue.empty")} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="queue-list">
          {items.map((p) => {
            const s = sla.get(p.org_id ?? "");
            const overdue = isOverdue(
              p,
              s?.review_sla_business_days ?? 3,
              new Date(),
              s?.weekend_days ?? [5, 6],
            );
            return (
              <li key={p.id}>
                <Link
                  to="/promotions/$id"
                  params={{ id: p.id }}
                  className="block rounded-lg border border-border bg-surface p-4 hover:bg-sunken"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-fg" dir="auto">
                      {p.title}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Badge>{t(`promo.reviewStatus.${p.review_status}` as TKey)}</Badge>
                      {overdue && <Badge variant="neutral">{t("review.queue.overdue")}</Badge>}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">
                    {t("review.queue.submittedAt")}: {date(p.submitted_at)} ·{" "}
                    {t("review.queue.deadline")}: {date(p.deadline_at)} ·{" "}
                    {p.assigned_reviewer_id
                      ? p.assigned_reviewer_id === user?.id
                        ? t("review.queue.mine")
                        : t("review.assignee")
                      : t("review.unassigned")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
