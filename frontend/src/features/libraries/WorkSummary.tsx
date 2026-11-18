import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { fetchMyOrgs } from "@/lib/api/features";
import { listPromotions } from "@/lib/api/promotions";
import { fetchQueue, isOverdue } from "@/lib/api/review";
import { claimsDue, fetchClaims } from "@/lib/api/libraries";
import { summarize } from "./model";

/** Role-aware counts at the top of the dashboard (Phase 5 task 9). Every count links to a filtered list. */
export function WorkSummary() {
  const { t } = useI18n();
  const { user } = useAuth();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  const roles = (orgs.data ?? [])
    .map((o) => o.org_members.find((m) => m.user_id === user?.id)?.role)
    .filter(Boolean) as string[];
  const reviewer = roles.some((r) => ["owner", "admin", "reviewer"].includes(r));
  const admin = roles.some((r) => ["owner", "admin"].includes(r));
  const mine = useQuery({
    queryKey: ["summary-promotions"],
    queryFn: () => listPromotions({}),
    enabled: Boolean(user),
  });
  const queue = useQuery({ queryKey: ["summary-queue"], queryFn: fetchQueue, enabled: reviewer });
  const due = useQuery({
    queryKey: ["summary-claims", orgs.data?.map((o) => o.id)],
    enabled: admin,
    queryFn: async () =>
      (await Promise.all((orgs.data ?? []).map((o) => fetchClaims(o.id)))).flat(),
  });
  if (!user || !orgs.data?.length) return null;
  const s = summarize({
    me: user.id,
    promotions: mine.data ?? [],
    queue: queue.data ?? [],
    overdue: (queue.data ?? []).filter((p) => isOverdue(p, 3)).length,
    claimsDue: claimsDue(due.data ?? []).length,
    reviewer,
    admin,
  });
  if (!s.length) return null;
  return (
    <Card className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="work-summary">
      {s.map((x) => (
        <Link
          key={x.key}
          to={x.to}
          search={x.search as never}
          className="rounded-md border border-border p-3 hover:bg-sunken"
        >
          <span className="block text-2xl font-bold text-fg">
            <bdi>{x.count}</bdi>
          </span>
          <span className="text-sm text-fg-muted">{t(`summary.${x.key}` as TKey)}</span>
        </Link>
      ))}
    </Card>
  );
}
