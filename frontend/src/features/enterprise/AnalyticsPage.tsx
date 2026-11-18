import { Link } from "@tanstack/react-router";
import { useErrorText } from "@/components/feedback/ApiErrorState";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
import {
  Card,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { fetchMetrics, flagOn, pct, type MetricFilters, type Stat } from "@/lib/api/flows";
import { CHANNELS, COMMUNICATION_TYPES, useOrgSettings, useProducts } from "@/lib/api/promotions";

const day = (d: Date) => d.toISOString().slice(0, 10);

/** /analytics — review metrics computed from events and sealed decisions (Phase 6.6). */
export function AnalyticsPage() {
  const { t, lang } = useI18n();
  const errText = useErrorText();
  const picker = useOrgPicker();
  const settings = useOrgSettings(picker.orgId || null);
  const products = useProducts(picker.orgId || null);
  const [from, setFrom] = useState(day(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(day(new Date()));
  const [filters, setFilters] = useState<MetricFilters>({});
  const allowed = ["owner", "admin", "reviewer"].includes(picker.role ?? "");
  const on = flagOn(settings.data?.features, "analytics");
  const m = useQuery({
    queryKey: ["org-metrics", picker.orgId, from, to, filters],
    queryFn: () =>
      fetchMetrics(
        picker.orgId,
        `${from}T00:00:00+03:00`,
        `${day(new Date(new Date(to).getTime() + 86_400_000))}T00:00:00+03:00`,
        filters,
      ),
    enabled: Boolean(picker.orgId && allowed && on && from && to),
  });
  const hours = (s: Stat | undefined) =>
    s?.n ? t("analytics.hoursValue", { mean: s.mean ?? 0, median: s.median ?? 0 }) : "—";

  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("analytics.title")} description={t("analytics.subtitle")} />
      <OrgSelect picker={picker} />
      {!allowed || !on ? (
        <EmptyState
          icon={<BarChart3 />}
          title={t("analytics.offTitle")}
          body={t("analytics.offBody")}
        />
      ) : (
        <>
          <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={t("analytics.from")}>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" />
            </Field>
            <Field label={t("analytics.to")}>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" />
            </Field>
            <Field label={t("analytics.product")}>
              <Select
                value={filters.product_id ?? ""}
                onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}
              >
                <option value="">{t("promo.allOption")}</option>
                {(products.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {(lang === "en" && p.name_en) || p.name_ar}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("analytics.channel")}>
              <Select
                value={filters.channel ?? ""}
                onChange={(e) => setFilters({ ...filters, channel: e.target.value })}
              >
                <option value="">{t("promo.allOption")}</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {t(`promo.channel.${c}` as TKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("analytics.type")}>
              <Select
                value={filters.communication_type ?? ""}
                onChange={(e) => setFilters({ ...filters, communication_type: e.target.value })}
              >
                <option value="">{t("promo.allOption")}</option>
                {COMMUNICATION_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {t(`promo.commType.${c}` as TKey)}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
          {m.isPending ? (
            <Skeleton className="h-48 w-full" />
          ) : !m.data ? (
            <p className="text-sm text-red" role="alert">
              {errText(m.error)}
            </p>
          ) : (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="metrics">
                <Tile
                  label={t("analytics.promotionsSubmitted")}
                  value={m.data.promotions_submitted}
                />
                <Tile
                  label={t("analytics.versionsSubmitted")}
                  value={m.data.versions_submitted}
                  hint={t("analytics.avgVersions", { n: m.data.avg_versions })}
                />
                <Tile
                  label={t("analytics.sla", { n: m.data.range.sla_business_days })}
                  value={pct(m.data.sla_compliance)}
                  hint={t("analytics.decided", { n: m.data.reviews_decided })}
                />
                <Tile label={t("analytics.firstTime")} value={pct(m.data.first_time_approval)} />
                <Tile label={t("analytics.early")} value={pct(m.data.early_requests)} />
                <Tile
                  label={t("analytics.approvalTime")}
                  value={hours(m.data.approval_time_hours)}
                />
                <Tile
                  label={t("analytics.firstResponse")}
                  value={hours(m.data.first_response_hours)}
                />
                <Tile
                  label={t("analytics.iterations")}
                  value={
                    m.data.iterations.n
                      ? `${m.data.iterations.mean} / ${m.data.iterations.median}`
                      : "—"
                  }
                  hint={t("analytics.meanMedian")}
                />
              </section>
              <p className="text-xs text-fg-muted">
                {t("analytics.riskNote", { n: m.data.risk_accepted })}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <Bars
                  title={t("analytics.byStatus")}
                  data={m.data.volume.by_status}
                  label={(k) => t(`promo.reviewStatus.${k}` as TKey)}
                  link={(k) => ({ status: k })}
                />
                <Bars
                  title={t("analytics.byChannel")}
                  data={m.data.volume.by_channel}
                  label={(k) => t(`promo.channel.${k}` as TKey)}
                />
                <Bars
                  title={t("analytics.byType")}
                  data={m.data.volume.by_type}
                  label={(k) => t(`promo.commType.${k}` as TKey)}
                />
                <Bars
                  title={t("analytics.byProduct")}
                  data={m.data.volume.by_product}
                  label={(k) => k}
                />
                <Bars
                  title={t("analytics.reasons")}
                  data={Object.fromEntries(
                    m.data.reasons
                      .map((r) => [lang === "en" ? r.label_en : r.label_ar, r.count])
                      .concat(
                        m.data.reasons_other
                          ? [[t("review.reasonOther"), m.data.reasons_other]]
                          : [],
                      ),
                  )}
                  label={(k) => k}
                />
                <Card className="flex flex-col gap-2">
                  <CardTitle>{t("analytics.workload")}</CardTitle>
                  <table className="text-sm">
                    <thead>
                      <tr className="text-start text-fg-muted">
                        <th className="text-start font-medium">{t("analytics.reviewer")}</th>
                        <th className="text-start font-medium">{t("analytics.decisions")}</th>
                        <th className="text-start font-medium">{t("analytics.open")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.data.workload.map((w) => (
                        <tr key={w.user_id}>
                          <td>{w.name ?? w.user_id.slice(0, 8)}</td>
                          <td>
                            <bdi>{w.decisions}</bdi>
                          </td>
                          <td>
                            <Link to="/queue" className="underline-offset-2 hover:underline">
                              <bdi>{w.open}</bdi>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </Page>
  );
}

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm text-fg-muted">{label}</span>
      <Link
        to="/promotions"
        className="text-2xl font-bold text-fg underline-offset-2 hover:underline"
      >
        <bdi>{value}</bdi>
      </Link>
      {hint && <span className="text-xs text-fg-muted">{hint}</span>}
    </Card>
  );
}

function Bars({
  title,
  data,
  label,
  link,
}: {
  title: string;
  data: Record<string, number>;
  label: (k: string) => string;
  link?: (k: string) => { status: string };
}) {
  const { t } = useI18n();
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>{title}</CardTitle>
      {!rows.length ? (
        <p className="text-sm text-fg-muted">{t("analytics.noData")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {rows.map(([k, n]) => (
            <li key={k} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-2">
              <span className="truncate" dir="auto">
                {label(k)}
              </span>
              <span className="h-2 rounded-full bg-sunken" aria-hidden="true">
                <span
                  className="block h-2 rounded-full bg-fg"
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </span>
              <Link
                to="/promotions"
                search={(link ? link(k) : {}) as never}
                className="underline-offset-2 hover:underline"
              >
                <bdi>{n}</bdi>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
