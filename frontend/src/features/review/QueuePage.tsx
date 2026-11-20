// /queue — review queue (V2 upgrade §12, D180): role-specific default view, counters per filter, cards with product,
// campaign, creator, dates, version, workflow state, findings and urgency, and direct assignment for managers
// (eligible reviewers only, never the uploader; the server re-checks with assign_reviewer).
import { Link } from "@tanstack/react-router";
import { ApiErrorState } from "@/components/feedback/ApiErrorState";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Inbox, Repeat2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Page,
  PageHeader,
  Select,
  Skeleton,
  StatusChip,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";
import { fetchMyMemberships } from "@/lib/api/features";
import type { Promotion } from "@/lib/api/promotions";
import { assignReviewer, eligibleReviewers, fetchQueue, isOverdue, rk } from "@/lib/api/review";
import { filterQueue, usePreflightText, type QueueTab as Tab } from "./model";
import { cn } from "@/lib/utils";

interface Details {
  products: Map<string, { name_ar: string; name_en: string | null }>;
  campaigns: Map<string, string>;
  people: Map<string, string>;
  versions: Map<
    string,
    { version_no: number | null; user_id: string; overall_status: string | null }
  >;
  counts: Map<string, { v: number; w: number }>;
}

/** Everything a card shows, in five reads the caller is allowed to make (RLS decides). */
async function fetchDetails(items: Promotion[]): Promise<Details> {
  const ids = <K extends keyof Promotion>(k: K) =>
    [...new Set(items.map((p) => p[k]).filter(Boolean))] as string[];
  const [prods, camps, members, subs, runs] = await Promise.all([
    ids("product_id").length
      ? supabase.from("products").select("id, name_ar, name_en").in("id", ids("product_id"))
      : Promise.resolve({ data: [] }),
    ids("campaign_id").length
      ? supabase.from("campaigns").select("id, name").in("id", ids("campaign_id"))
      : Promise.resolve({ data: [] }),
    ids("org_id").length
      ? supabase
          .from("org_members")
          .select("user_id, display_name, email")
          .in("org_id", ids("org_id"))
      : Promise.resolve({ data: [] }),
    ids("current_version_id").length
      ? supabase
          .from("submissions")
          .select("id, version_no, user_id, overall_status")
          .in("id", ids("current_version_id"))
      : Promise.resolve({ data: [] }),
    ids("current_version_id").length
      ? supabase
          .from("analysis_runs")
          .select("id, submission_id, started_at")
          .in("submission_id", ids("current_version_id"))
      : Promise.resolve({ data: [] }),
  ]);
  const latest = new Map<string, { id: string; started_at: string }>();
  for (const r of (runs.data ?? []) as {
    id: string;
    submission_id: string;
    started_at: string;
  }[]) {
    const cur = latest.get(r.submission_id);
    if (!cur || r.started_at > cur.started_at) latest.set(r.submission_id, r);
  }
  const runIds = [...latest.values()].map((r) => r.id);
  const findings = runIds.length
    ? ((
        await supabase
          .from("findings")
          .select("run_id, severity, submission_id")
          .in("run_id", runIds)
      ).data ?? [])
    : [];
  const counts = new Map<string, { v: number; w: number }>();
  for (const f of findings as { submission_id: string; severity: string }[]) {
    const c = counts.get(f.submission_id) ?? { v: 0, w: 0 };
    if (f.severity === "violation") c.v++;
    else c.w++;
    counts.set(f.submission_id, c);
  }
  return {
    products: new Map(
      ((prods.data ?? []) as { id: string; name_ar: string; name_en: string | null }[]).map((p) => [
        p.id,
        p,
      ]),
    ),
    campaigns: new Map(
      ((camps.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]),
    ),
    people: new Map(
      (
        (members.data ?? []) as {
          user_id: string;
          display_name: string | null;
          email: string | null;
        }[]
      ).map((m) => [m.user_id, m.display_name || m.email || "—"]),
    ),
    versions: new Map(
      (
        (subs.data ?? []) as {
          id: string;
          version_no: number | null;
          user_id: string;
          overall_status: string | null;
        }[]
      ).map((s) => [s.id, s]),
    ),
    counts,
  };
}

export function QueuePage() {
  const { t, lang, formatDate } = useI18n();
  const { user } = useAuth();
  const queue = useQuery({ queryKey: rk.queue, queryFn: fetchQueue });
  const memberships = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: fetchMyMemberships,
    enabled: Boolean(user),
  });
  const roles = new Set((memberships.data ?? []).map((m) => m.role));
  const manager = ["owner", "admin", "compliance_lead"].some((r) => roles.has(r));
  const [tab, setTab] = useState<Tab | null>(null);
  const all = queue.data ?? [];
  // §12.1: managers start on unassigned (or everything pending), reviewers on their own cases.
  useEffect(() => {
    if (tab || !queue.data || !memberships.data) return;
    if (!manager) setTab("mine");
    else setTab(filterQueue(all, "unassigned", user?.id ?? null).length ? "unassigned" : "all");
  }, [tab, queue.data, memberships.data, manager, all, user?.id]);
  const current = tab ?? "mine";
  const details = useQuery({
    queryKey: ["queue-details", all.map((p) => `${p.id}:${p.current_version_id}`).join(",")],
    queryFn: () => fetchDetails(all),
    enabled: all.length > 0,
  });
  const orgIds = [...new Set(all.map((p) => p.org_id).filter((x): x is string => Boolean(x)))];
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
  const tabs: Tab[] = manager
    ? ["unassigned", "all", "mine", "escalation"]
    : ["mine", "escalation", "all"];
  const items = filterQueue(all, current, user?.id ?? null);
  const d = details.data;

  return (
    <Page wide className="flex flex-col gap-5">
      <PageHeader title={t("review.queue.title")} description={t("review.queue.subtitle")} />
      <div role="tablist" aria-label={t("review.queue.title")} className="flex flex-wrap gap-1.5">
        {tabs.map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={current === k}
            onClick={() => setTab(k)}
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm",
              current === k
                ? "border-ink bg-ink text-white"
                : "border-border bg-surface hover:bg-sunken",
            )}
          >
            {t(`review.queue.${k}` as TKey)}
            <span
              className="tabular rounded-full bg-black/10 px-2 text-xs"
              data-testid={`count-${k}`}
            >
              {filterQueue(all, k, user?.id ?? null).length}
            </span>
          </button>
        ))}
      </div>
      {queue.isPending ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : queue.isError ? (
        <ApiErrorState
          title={t("review.queue.title")}
          error={queue.error}
          onRetry={() => void queue.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox />} title={t("review.queue.empty")} />
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2" data-testid="queue-list">
          {items.map((p) => {
            const s = sla.get(p.org_id ?? "");
            const overdue = isOverdue(
              p,
              s?.review_sla_business_days ?? 3,
              new Date(),
              s?.weekend_days ?? [5, 6],
            );
            const v = d?.versions.get(p.current_version_id ?? "");
            const c = d?.counts.get(p.current_version_id ?? "");
            const product = p.product_id ? d?.products.get(p.product_id) : null;
            const resubmitted = (v?.version_no ?? 1) > 1 || Boolean(p.first_decision_at);
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
                data-testid="queue-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    to="/promotions/$id"
                    params={{ id: p.id }}
                    className="text-lg font-bold text-fg underline-offset-4 hover:underline"
                    dir="auto"
                  >
                    {p.title}
                  </Link>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusChip
                      tone={p.review_status === "escalated" ? "warning" : "processing"}
                      size="sm"
                    >
                      {t(`promo.reviewStatus.${p.review_status}` as TKey)}
                    </StatusChip>
                    {overdue && (
                      <Badge variant="outline" className="text-red">
                        {t("review.queue.overdue")}
                      </Badge>
                    )}
                    <Badge variant="neutral">
                      {resubmitted ? (
                        <span className="inline-flex items-center gap-1">
                          <Repeat2 aria-hidden="true" className="size-3.5" />
                          {t("queue2.resubmitted")}
                        </span>
                      ) : (
                        t("queue2.new")
                      )}
                    </Badge>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                  <Item label={t("ws.header.product")}>
                    {product ? (lang === "en" && product.name_en) || product.name_ar : "—"}
                  </Item>
                  <Item label={t("ws.header.campaign")}>
                    {(p.campaign_id && d?.campaigns.get(p.campaign_id)) || "—"}
                  </Item>
                  <Item label={t("ws.header.creator")}>
                    {(v && d?.people.get(v.user_id)) || "—"}
                  </Item>
                  <Item label={t("queue2.version")}>
                    {v?.version_no ? t("ws.header.version", { n: v.version_no }) : "—"}
                  </Item>
                  <Item label={t("review.queue.submittedAt")}>
                    {p.submitted_at ? formatDate(p.submitted_at) : "—"}
                  </Item>
                  <Item label={t("review.queue.deadline")}>
                    {p.deadline_at ? (
                      <span className={cn("inline-flex items-center gap-1", overdue && "text-red")}>
                        <CalendarClock aria-hidden="true" className="size-3.5" />
                        {formatDate(p.deadline_at)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Item>
                  <Item label={t("queue2.findings")}>
                    {c ? (
                      <span className="tabular">
                        <span className={c.v ? "font-bold text-red" : ""}>
                          {t("queue2.v", { n: c.v })}
                        </span>{" "}
                        ·{" "}
                        <span className={c.w ? "text-amber-text" : ""}>
                          {t("queue2.w", { n: c.w })}
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </Item>
                  <Item label={t("ws.header.assignee")}>
                    {p.assigned_reviewer_id
                      ? p.assigned_reviewer_id === user?.id
                        ? t("review.queue.mine")
                        : (d?.people.get(p.assigned_reviewer_id) ?? "—")
                      : t("review.unassigned")}
                  </Item>
                </dl>
                {manager && ["pending_review", "in_review"].includes(p.review_status) && (
                  <QuickAssign promotion={p} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="truncate font-medium" dir="auto">
        {children}
      </dd>
    </div>
  );
}

/** Assign from the queue without opening the advertisement (§12.3). */
function QuickAssign({ promotion: p }: { promotion: Promotion }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const [open, setOpen] = useState(false);
  const list = useQuery({
    queryKey: rk.eligible(p.id),
    queryFn: () => eligibleReviewers(p.id),
    enabled: open,
  });
  const assign = useMutation({
    mutationFn: (u: string) => assignReviewer(p.id, u),
    onSuccess: () => {
      toast.success(t("review.assignedToast"));
      setOpen(false);
      void qc.invalidateQueries({ queryKey: rk.queue });
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!open)
    return (
      <Button
        size="sm"
        variant="secondary"
        icon={<UserPlus />}
        className="self-start"
        onClick={() => setOpen(true)}
      >
        {p.assigned_reviewer_id ? t("queue2.reassign") : t("queue2.assign")}
      </Button>
    );
  return (
    <label className="flex flex-col gap-1 text-sm sm:max-w-md">
      <span className="font-medium">{t("review.assignee")}</span>
      <Select
        autoFocus
        disabled={assign.isPending || list.isPending}
        value={p.assigned_reviewer_id ?? ""}
        onChange={(e) => e.target.value && assign.mutate(e.target.value)}
      >
        <option value="">{list.isPending ? t("common.loading") : t("review.unassigned")}</option>
        {(list.data ?? []).map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {[
              m.display_name || m.email,
              m.display_name ? m.email : null,
              t(`org.roles.${m.role}` as TKey),
              t("ws.assign.workload", { n: m.open_cases }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </option>
        ))}
      </Select>
    </label>
  );
}
