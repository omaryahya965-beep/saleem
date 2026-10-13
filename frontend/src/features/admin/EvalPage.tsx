import { FlaskConical, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Card, EmptyState, ErrorState, Page, PageHeader, Skeleton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { useEvalRuns, useIsAdmin } from "@/lib/api/hooks";

interface Summary {
  cases: number;
  mode: string;
  recall: number;
  precision: number;
  hits: number;
  misses: number;
  false_alarms: number;
  avg_ms_per_case: number;
  avg_cost_usd_per_case: number;
}
interface RuleRow {
  rule: string;
  hits: number;
  misses: number;
  false_alarms: number;
  recall: number | null;
  precision: number | null;
  mean_t_error_s: number | null;
}
interface CaseRow {
  id: string;
  title: string;
  ms: number;
  cost_usd: number;
  outcome: Record<string, "hit" | "miss" | "false_alarm">;
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="tabular text-3xl font-bold text-fg">{value}</span>
      {sub && <span className="text-xs text-fg-muted">{sub}</span>}
    </Card>
  );
}

/** Recall as a single-hue meter; the number is always printed next to it. */
function Meter({ value }: { value: number | null }) {
  if (value === null) return <span className="text-fg-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-20 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-green"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
      <span className="tabular">{Math.round(value * 100)}%</span>
    </span>
  );
}

export function EvalPage() {
  const { t, formatNumber, formatDate } = useI18n();
  const { user } = useAuth();
  const admin = useIsAdmin(user?.id);
  const runs = useEvalRuns();
  const pct = (n: number) => formatNumber(n, { style: "percent", maximumFractionDigits: 0 });

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

  const latest = runs.data?.[0];
  const summary = latest?.summary as unknown as Summary | undefined;
  const perRule = (latest?.per_rule as unknown as RuleRow[] | undefined) ?? [];
  const cases = (latest?.cases as unknown as CaseRow[] | undefined) ?? [];

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("admin.evalTitle")}
        description={t("admin.evalSubtitle")}
        eyebrow={
          latest && (
            <Badge variant="outline">
              {formatDate(latest.created_at, true)} · {latest.llm_model ?? "deterministic"} ·{" "}
              {latest.prompt_version}
            </Badge>
          )
        }
      />
      {runs.isError ? (
        <ErrorState
          title={t("admin.loadError")}
          retryLabel={t("common.retry")}
          onRetry={() => void runs.refetch()}
        />
      ) : runs.isPending ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : !latest || !summary ? (
        <EmptyState
          icon={<FlaskConical />}
          title={t("admin.evalEmptyTitle")}
          body={t("admin.evalEmptyBody")}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label={t("admin.recall")}
              value={pct(summary.recall)}
              sub={t("admin.hitsOf", { hits: summary.hits, total: summary.hits + summary.misses })}
            />
            <Tile
              label={t("admin.precision")}
              value={pct(summary.precision)}
              sub={t("admin.falseAlarms", { n: summary.false_alarms })}
            />
            <Tile
              label={t("admin.timePerClip")}
              value={`${formatNumber(summary.avg_ms_per_case / 1000, { maximumFractionDigits: 1 })} ${t("units.seconds")}`}
              sub={t("admin.cases", { n: summary.cases })}
            />
            <Tile
              label={t("admin.costPerClip")}
              value={`$${summary.avg_cost_usd_per_case.toFixed(4)}`}
              sub={summary.mode}
            />
          </div>

          <Card padded={false} className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="px-5 pt-4 pb-2 text-start text-base font-bold">
                {t("admin.perRule")}
              </caption>
              <thead>
                <tr className="border-y border-border bg-sunken text-xs text-fg-muted">
                  {[
                    "rule",
                    "hits",
                    "misses",
                    "falseAlarmsCol",
                    "recall",
                    "precision",
                    "tError",
                  ].map((k) => (
                    <th key={k} scope="col" className="px-4 py-2.5 text-start font-medium">
                      {t(`admin.col.${k}` as never)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perRule.map((r) => (
                  <tr key={r.rule} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-mono text-xs" dir="ltr">
                      {r.rule}
                    </td>
                    <td className="tabular px-4 py-2.5">{r.hits}</td>
                    <td className="tabular px-4 py-2.5">{r.misses}</td>
                    <td className="tabular px-4 py-2.5">{r.false_alarms}</td>
                    <td className="px-4 py-2.5">
                      <Meter value={r.recall} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Meter value={r.precision} />
                    </td>
                    <td className="tabular px-4 py-2.5">
                      {r.mean_t_error_s === null
                        ? "—"
                        : `${r.mean_t_error_s.toFixed(1)} ${t("units.seconds")}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card padded={false}>
            <h2 className="px-5 pt-4 pb-2 text-base font-bold">{t("admin.casesHeading")}</h2>
            <ul className="divide-y divide-border">
              {cases.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm"
                >
                  <span className="min-w-0 flex-1 font-medium">{c.title}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {Object.entries(c.outcome).map(([rule, o]) => (
                      <Badge
                        key={rule}
                        variant={o === "hit" ? "green" : "outline"}
                        className={o === "hit" ? "" : "text-red"}
                      >
                        <span dir="ltr" className="font-mono">
                          {rule}
                        </span>
                        &nbsp;{t(`admin.outcome.${o}` as never)}
                      </Badge>
                    ))}
                  </span>
                  <span className="tabular text-fg-muted">
                    {(c.ms / 1000).toFixed(1)} {t("units.seconds")} · ${c.cost_usd.toFixed(4)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </Page>
  );
}
