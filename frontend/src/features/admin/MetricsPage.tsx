import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  SegmentedControl,
  Skeleton,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { useIsAdmin } from "@/lib/api/hooks";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

interface Metrics {
  submissions: number;
  users: number;
  runs: number;
  failed: number;
  cancelled: number;
  status: Record<string, number>;
  cost_usd: number;
  avg_cost_usd: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  by_model: { llm_model: string | null; runs: number; cost: number | null }[];
  daily: { day: string; checks: number; failed: number }[];
  recent_errors: { started_at: string; error: string }[];
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="tabular text-3xl font-bold">{value}</span>
      {sub && <span className="text-xs text-fg-muted">{sub}</span>}
    </Card>
  );
}

/** /admin/metrics — runs, failures, durations and cost (admin only). */
export function MetricsPage() {
  const { t, formatNumber, formatDate } = useI18n();
  const { user } = useAuth();
  const admin = useIsAdmin(user?.id);
  const [days, setDays] = useState<"7" | "30" | "90">("30");
  const q = useQuery({
    queryKey: ["admin-metrics", days],
    enabled: admin.data === true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_metrics", { _days: Number(days) });
      if (error) throw error;
      return data as unknown as Metrics;
    },
  });

  if (admin.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  if (!admin.data)
    return (
      <Page narrow>
        <EmptyState
          icon={<ShieldAlert />}
          title={t("admin.forbiddenTitle")}
          body={t("admin.forbiddenBody")}
        />
      </Page>
    );

  const sec = (ms: number | null) =>
    ms == null
      ? "—"
      : `${formatNumber(ms / 1000, { maximumFractionDigits: 1 })} ${t("units.seconds")}`;
  const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(n < 1 ? 4 : 2)}`);
  const m = q.data;
  const maxDaily = Math.max(1, ...(m?.daily ?? []).map((d) => d.checks));

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("metrics.title")}
        description={t("metrics.subtitle")}
        actions={
          <SegmentedControl
            label={t("metrics.range")}
            value={days}
            onValueChange={setDays}
            options={(["7", "30", "90"] as const).map((d) => ({
              value: d,
              label: t("metrics.days", { n: d }),
            }))}
          />
        }
      />
      {q.isError ? (
        <ErrorState
          title={t("admin.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void q.refetch()}
        />
      ) : !m ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label={t("metrics.checks")}
              value={formatNumber(m.submissions)}
              sub={t("metrics.users", { n: m.users })}
            />
            <Tile
              label={t("metrics.failed")}
              value={formatNumber(m.failed)}
              sub={t("metrics.failRate", {
                p: m.submissions ? Math.round((m.failed / m.submissions) * 100) : 0,
              })}
            />
            <Tile
              label={t("metrics.duration")}
              value={sec(m.p50_ms)}
              sub={t("metrics.p95", { v: sec(m.p95_ms) })}
            />
            <Tile
              label={t("metrics.cost")}
              value={usd(m.cost_usd)}
              sub={t("metrics.avgCost", { v: usd(m.avg_cost_usd) })}
            />
          </div>

          <Card>
            <h2 className="mb-4 text-base font-bold">{t("metrics.daily")}</h2>
            {m.daily.length === 0 ? (
              <p className="text-sm text-fg-muted">{t("metrics.noData")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sr-only">
                  <tr>
                    <th>{t("dashboard.colDate")}</th>
                    <th>{t("metrics.checks")}</th>
                    <th>{t("metrics.failed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {m.daily.map((d) => (
                    <tr key={d.day} className="align-middle">
                      <td className="w-32 py-1 text-fg-muted">{formatDate(d.day)}</td>
                      <td className="py-1">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-3 rounded-e-sm bg-green"
                            style={{ width: `${(d.checks / maxDaily) * 70}%` }}
                            aria-hidden="true"
                          />
                          <span className="tabular">{d.checks}</span>
                          {d.failed > 0 && (
                            <span className="tabular text-red">
                              ({t("metrics.failedN", { n: d.failed })})
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-3 text-base font-bold">{t("metrics.byModel")}</h2>
              <ul className="divide-y divide-border text-sm">
                {m.by_model.map((b) => (
                  <li key={b.llm_model ?? "none"} className="flex justify-between gap-3 py-2">
                    <span dir="ltr" className="font-mono text-xs">
                      {b.llm_model ?? "—"}
                    </span>
                    <span className="tabular text-fg-muted">
                      {t("metrics.runsCost", { n: b.runs, cost: usd(b.cost) })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-bold">{t("metrics.errors")}</h2>
              {m.recent_errors.length === 0 ? (
                <p className="text-sm text-fg-muted">{t("metrics.noErrors")}</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {m.recent_errors.map((e, i) => (
                    <li key={i} className="py-2">
                      <span className="block text-xs text-fg-muted">
                        {formatDate(e.started_at, true)}
                      </span>
                      <span dir="ltr" className="block font-mono text-xs break-words">
                        {e.error}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </Page>
  );
}
