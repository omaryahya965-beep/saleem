// Team & Workspace — Overview tab (V2 completion §4, D193): operational counts from `workspace_overview`
// (advertisements vs versions vs analysis runs kept distinct), reviewer workload, campaigns and recent decisions.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardTitle, Skeleton } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface Overview {
  by_status: Record<string, number>;
  unassigned: number;
  overdue: number;
  advertisements: number;
  versions: number;
  analysis_runs: number;
  partner_submissions: number;
  workload: { user_id: string; name: string | null; role: string; open: number }[];
  campaigns: {
    id: string;
    name: string;
    brand: string | null;
    starts_on: string | null;
    ends_on: string | null;
    ads: number;
    approved: number;
    in_review: number;
    products: string[];
  }[];
  recent_decisions: { promotion_id: string; title: string; decision: string; created_at: string }[];
}

export const useWorkspaceOverview = (orgId: string, enabled = true) =>
  useQuery({
    queryKey: ["workspace-overview", orgId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (
          f: string,
          a: object,
        ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
      )("workspace_overview", { _org: orgId });
      if (error) throw new Error(error.message);
      return data as Overview;
    },
  });

export function WorkspaceOverview({ orgId }: { orgId: string }) {
  const { t, formatDate } = useI18n();
  const q = useWorkspaceOverview(orgId);
  if (q.isPending) return <Skeleton className="h-48 w-full rounded-lg" />;
  if (!q.data) return null;
  const o = q.data;
  const s = (k: string) => o.by_status[k] ?? 0;
  const tiles = [
    { k: "advertisements", n: o.advertisements },
    { k: "versions", n: o.versions },
    { k: "runs", n: o.analysis_runs },
    { k: "pending", n: s("pending_review") + s("in_review") + s("escalated") },
    { k: "unassigned", n: o.unassigned, tone: "amber" },
    { k: "overdue", n: o.overdue, tone: "red" },
    { k: "changes", n: s("changes_requested") },
    { k: "conditional", n: s("conditionally_approved") },
    { k: "approved", n: s("approved") },
    { k: "rejected", n: s("rejected") },
    { k: "partner", n: o.partner_submissions },
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="workspace-overview">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
        {tiles.map((x) => (
          <div key={x.k} className="rounded-md border border-border bg-surface p-3">
            <dt className="text-xs text-fg-muted">{t(`team.tile.${x.k}` as TKey)}</dt>
            <dd
              className={cn(
                "tabular text-2xl font-bold",
                x.n > 0 && x.tone === "red" && "text-red",
                x.n > 0 && x.tone === "amber" && "text-amber-text",
              )}
            >
              {x.n}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-fg-muted">{t("team.countsNote")}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("team.workload")}</CardTitle>
          <ul className="flex flex-col gap-1.5 text-sm">
            {o.workload.map((w) => (
              <li key={w.user_id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">
                  {w.name ?? "—"}{" "}
                  <span className="text-fg-muted">· {t(`org.roles.${w.role}` as TKey)}</span>
                </span>
                <span
                  className="h-2 w-24 overflow-hidden rounded-full bg-sunken"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full bg-green"
                    style={{ width: `${Math.min(100, w.open * 10)}%` }}
                  />
                </span>
                <span className="tabular w-8 text-end">{w.open}</span>
              </li>
            ))}
          </ul>
          <Link to="/queue" className="text-sm text-green underline-offset-4 hover:underline">
            {t("team.openQueue")}
          </Link>
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>{t("team.recentDecisions")}</CardTitle>
          {o.recent_decisions.length === 0 ? (
            <p className="text-sm text-fg-muted">{t("common.none")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {o.recent_decisions.map((d, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/promotions/$id"
                    params={{ id: d.promotion_id }}
                    className="truncate underline-offset-4 hover:underline"
                    dir="auto"
                  >
                    {d.title}
                  </Link>
                  <span className="text-fg-muted">
                    {t(`review.decision.${d.decision}` as TKey)} · {formatDate(d.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Campaign progress rows (Campaigns tab). */
export function CampaignProgress({ c }: { c: Overview["campaigns"][number] }) {
  const { t } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const status =
    c.ends_on && c.ends_on < today
      ? "ended"
      : c.starts_on && c.starts_on > today
        ? "upcoming"
        : "active";
  const pct = c.ads ? Math.round((c.approved / c.ads) * 100) : 0;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sunken px-2 text-xs">
          {t(`team.campaignStatus.${status}` as TKey)}
        </span>
        <span className="text-fg-muted">
          {t("team.campaignCounts", { ads: c.ads, review: c.in_review, approved: c.approved })}
        </span>
      </div>
      {c.products.length > 0 && (
        <span className="text-xs text-fg-muted">
          {t("team.products")}: {c.products.join("، ")}
        </span>
      )}
      <span
        className="h-1.5 w-full overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("team.approvalProgress")}
      >
        <span className="block h-full bg-green" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
