import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardTitle, Skeleton } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import { fetchHistory, rk, verifyChain } from "@/lib/api/review";
import { shortHash } from "@/features/reports/model";
import { bothCalendars } from "./model";

/** Timeline of review events and decisions, with decision-chain verification (05_UX_SPEC §2.4). */
export function HistoryPanel({
  promotion: p,
  versions,
}: {
  promotion: Promotion;
  versions: VersionSummary[];
}) {
  const { t, lang } = useI18n();
  const history = useQuery({
    queryKey: rk.history(p.id),
    queryFn: () =>
      fetchHistory(
        p.id,
        versions.map((v) => v.id),
      ),
  });
  const verify = useMutation({ mutationFn: () => verifyChain(p.id) });
  if (history.isPending) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (history.isError) return <p className="text-sm text-red">{t("errors.network")}</p>;
  const { events, decisions, shareReviews } = history.data;
  const decisionById = new Map(decisions.map((d) => [d.id, d]));
  return (
    <div className="flex flex-col gap-4" data-testid="history-panel">
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{t("review.history.title")}</CardTitle>
          {decisions.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              loading={verify.isPending}
              onClick={() => verify.mutate()}
            >
              {t("review.history.verify")}
            </Button>
          )}
        </div>
        {verify.data && (
          <p
            role="status"
            className={
              verify.data.valid
                ? "flex items-center gap-2 text-sm text-green"
                : "flex items-center gap-2 text-sm text-red"
            }
          >
            {verify.data.valid ? (
              <ShieldCheck className="size-4" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-4" aria-hidden="true" />
            )}
            {verify.data.valid ? t("review.history.valid") : t("review.history.broken")}
          </p>
        )}
        {events.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("review.history.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {events.map((e) => {
              const payload = (e.payload ?? {}) as {
                decision_id?: string;
                note?: string;
                reason?: string;
                version_no?: number;
              };
              const d = payload.decision_id ? decisionById.get(payload.decision_id) : undefined;
              const k = `review.history.event.${e.event_type}` as TKey;
              const label = t(k);
              return (
                <li key={e.id} className="border-s-2 border-border ps-3 text-sm">
                  <p className="font-medium text-fg">
                    {label === k ? e.event_type : label}
                    {payload.version_no ? (
                      <>
                        {" "}
                        · <bdi>{t("promo.versionShort", { n: payload.version_no })}</bdi>
                      </>
                    ) : null}
                    {d && <> · {t(`review.decision.${d.decision}` as TKey)}</>}
                  </p>
                  <p className="text-xs text-fg-muted">{bothCalendars(e.created_at, lang)}</p>
                  {payload.note && (
                    <p className="mt-1 text-fg" dir="auto">
                      {payload.note}
                    </p>
                  )}
                  {payload.reason && (
                    <p className="mt-1 text-fg" dir="auto">
                      {payload.reason}
                    </p>
                  )}
                  {d?.condition_ar && (
                    <p className="mt-1 text-fg" dir="auto">
                      {t("review.condition")}: {d.condition_ar}
                    </p>
                  )}
                  {d?.comment && (
                    <p className="mt-1 text-fg" dir="auto">
                      {d.comment}
                    </p>
                  )}
                  {d && (
                    <p className="mt-1 text-xs text-fg-muted">
                      {t("review.history.hash")}:{" "}
                      <bdi className="font-mono">{shortHash(d.hash)}</bdi>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      {shareReviews.length > 0 && (
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("review.history.shareReviews")}</CardTitle>
          <ul className="flex flex-col gap-2 text-sm">
            {shareReviews.map((r) => (
              <li key={r.id}>
                <Badge>{r.decision}</Badge> {r.reviewer_name ?? ""} —{" "}
                <span dir="auto">{r.comment ?? ""}</span>
                <span className="block text-xs text-fg-muted">
                  {bothCalendars(r.created_at, lang)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
