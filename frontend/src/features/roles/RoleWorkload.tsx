// Role-specific dashboard workspace (V2 completion §10, D197). Every number and list comes from advertisements the
// caller can read (RLS) or from `workspace_overview` (owner / admin / compliance lead / viewer only). Nothing is
// hard-coded and nothing outside the role's scope is fetched.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Scale, Sparkles } from "lucide-react";
import { Badge, Button, Card, CardTitle, EmptyState } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { useWorkspaceOverview } from "@/features/org/WorkspaceOverview";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  review_status: string;
  assigned_reviewer_id: string | null;
  owner_id: string | null;
  escalated_to: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  first_decision_at: string | null;
  updated_at: string;
};
type Tile = { key: string; n: number; to: "/queue" | "/promotions"; tone?: "red" | "amber" };
const OPEN = new Set(["pending_review", "in_review", "escalated"]);
const MANAGERS = ["owner", "admin", "compliance_lead", "viewer"];

export function RoleWorkload() {
  const { t } = useI18n();
  const { user } = useAuth();
  const picker = useOrgPicker();
  const role = picker.role;
  const q = useQuery({
    queryKey: ["role-workload", picker.orgId, user?.id],
    enabled: Boolean(picker.orgId && user && role && role !== "external_reviewer"),
    queryFn: async () =>
      ((
        await supabase
          .from("promotions")
          .select(
            "id, title, review_status, assigned_reviewer_id, owner_id, escalated_to, deadline_at, submitted_at, first_decision_at, updated_at",
          )
          .eq("org_id", picker.orgId!)
          .order("updated_at", { ascending: false })
          .limit(1000)
      ).data ?? []) as Row[],
  });
  const overview = useWorkspaceOverview(
    picker.orgId ?? "",
    Boolean(picker.orgId && MANAGERS.includes(role ?? "")),
  );
  if (!role || !user) return null;
  if (role === "external_reviewer")
    return (
      <EmptyState
        icon={<Scale />}
        title={t("dash3.externalReviewer")}
        body={t("dash3.externalReviewerBody")}
      />
    );
  if (!q.data) return null;
  const rows = q.data;
  const now = new Date();
  const late = (r: Row) =>
    Boolean(r.deadline_at && new Date(r.deadline_at) < now && OPEN.has(r.review_status));
  const by = (s: string, f: (r: Row) => boolean = () => true) =>
    rows.filter((r) => r.review_status === s && f(r));
  const mine = (r: Row) => r.owner_id === user.id;
  const assigned = (r: Row) => r.assigned_reviewer_id === user.id;
  let tiles: Tile[] = [];
  let lists: { key: string; items: Row[]; empty?: string }[] = [];
  if (MANAGERS.includes(role)) {
    tiles = [
      { key: "awaiting", n: by("pending_review").length, to: "/queue" },
      {
        key: "unassigned",
        n: rows.filter((r) => OPEN.has(r.review_status) && !r.assigned_reviewer_id).length,
        to: "/queue",
        tone: "amber",
      },
      { key: "in_review", n: by("in_review").length, to: "/queue" },
      { key: "escalated", n: by("escalated").length, to: "/queue" },
      { key: "changes", n: by("changes_requested").length, to: "/promotions" },
      { key: "conditional", n: by("conditionally_approved").length, to: "/promotions" },
      { key: "approved", n: by("approved").length, to: "/promotions" },
      { key: "overdue", n: rows.filter(late).length, to: "/queue", tone: "red" },
    ];
    lists = [
      {
        key: "unassignedList",
        items: rows.filter((r) => OPEN.has(r.review_status) && !r.assigned_reviewer_id).slice(0, 6),
      },
      { key: "overdueList", items: rows.filter(late).slice(0, 6) },
    ];
  } else if (role === "reviewer") {
    const resub = (r: Row) =>
      assigned(r) && OPEN.has(r.review_status) && Boolean(r.first_decision_at);
    tiles = [
      { key: "assigned", n: by("pending_review", assigned).length, to: "/queue" },
      { key: "in_review", n: by("in_review", assigned).length, to: "/queue" },
      { key: "resubmitted", n: rows.filter(resub).length, to: "/queue" },
      { key: "verify", n: by("conditionally_approved", assigned).length, to: "/promotions" },
      {
        key: "overdue",
        n: rows.filter((r) => assigned(r) && late(r)).length,
        to: "/queue",
        tone: "red",
      },
    ];
    lists = [
      {
        key: "deadlines",
        items: rows
          .filter(
            (r) =>
              assigned(r) &&
              (OPEN.has(r.review_status) || r.review_status === "conditionally_approved"),
          )
          .sort((a, b) => (a.deadline_at ?? "9999").localeCompare(b.deadline_at ?? "9999"))
          .slice(0, 8),
      },
    ];
  } else if (role === "legal") {
    tiles = [
      {
        key: "legalOpen",
        n: rows.filter((r) => r.escalated_to === user.id && r.review_status === "escalated").length,
        to: "/queue",
      },
      {
        key: "legalAnswered",
        n: rows.filter((r) => r.review_status !== "escalated").length,
        to: "/promotions",
      },
    ];
    lists = [{ key: "legalCases", items: rows.slice(0, 8) }];
  } else {
    // Marketer and external partner: own advertisements only (RLS already restricts the rows).
    const own = rows.filter(mine);
    tiles = [
      {
        key: "drafts",
        n: own.filter((r) => r.review_status === "draft").length,
        to: "/promotions",
      },
      { key: "waiting", n: own.filter((r) => OPEN.has(r.review_status)).length, to: "/promotions" },
      {
        key: "changes",
        n: own.filter((r) => r.review_status === "changes_requested").length,
        to: "/promotions",
        tone: "amber",
      },
      {
        key: "conditional",
        n: own.filter((r) => r.review_status === "conditionally_approved").length,
        to: "/promotions",
        tone: "amber",
      },
      {
        key: "approved",
        n: own.filter((r) => r.review_status === "approved").length,
        to: "/promotions",
      },
      {
        key: "rejected",
        n: own.filter((r) => r.review_status === "rejected").length,
        to: "/promotions",
      },
    ];
    lists = [
      {
        key: "actionNeeded",
        items: own
          .filter((r) =>
            ["changes_requested", "conditionally_approved", "draft"].includes(r.review_status),
          )
          .slice(0, 8),
      },
      { key: "recent", items: own.filter((r) => r.first_decision_at).slice(0, 5) },
    ];
  }
  return (
    <div className="flex flex-col gap-4" data-testid="role-workload">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t(`dash3.title.${role}` as TKey)}</h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {tiles.map((x) => (
            <li key={x.key}>
              <Link
                to={x.to}
                className="flex h-full flex-col rounded-md bg-sunken p-3 hover:bg-line/40"
              >
                <span
                  className={cn(
                    "tabular text-2xl font-bold",
                    x.n > 0 && x.tone === "red" && "text-red",
                    x.n > 0 && x.tone === "amber" && "text-amber-text",
                  )}
                >
                  {x.n}
                </span>
                <span className="text-sm text-fg-muted">
                  {t(`dash2.tile.${x.key}` as TKey) !== `dash2.tile.${x.key}`
                    ? t(`dash2.tile.${x.key}` as TKey)
                    : t(`dash3.tile.${x.key}` as TKey)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {(role === "creator" || role === "external_uploader") && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <Sparkles aria-hidden="true" className="size-4 text-green" />
            {t("dash3.fixHint")}
          </p>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {lists.map((l) => (
          <Card key={l.key} className="flex flex-col gap-2">
            <CardTitle>{t(`dash3.list.${l.key}` as TKey)}</CardTitle>
            {l.items.length === 0 ? (
              <p className="text-sm text-fg-muted">{t("dash3.nothing")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {l.items.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link
                      to="/promotions/$id"
                      params={{ id: r.id }}
                      className="min-w-0 truncate font-medium underline-offset-4 hover:underline"
                      dir="auto"
                    >
                      {r.title}
                    </Link>
                    <span className="flex items-center gap-1.5">
                      <Badge>{t(`promo.reviewStatus.${r.review_status}` as TKey)}</Badge>
                      {r.deadline_at && (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            late(r) ? "text-red" : "text-fg-muted",
                          )}
                        >
                          <CalendarClock aria-hidden="true" className="size-3" />
                          {new Date(r.deadline_at).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
        {MANAGERS.includes(role) && overview.data && (
          <Card className="flex flex-col gap-2">
            <CardTitle>{t("team.workload")}</CardTitle>
            <ul className="flex flex-col gap-1 text-sm">
              {overview.data.workload.map((w) => (
                <li key={w.user_id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {w.name ?? "—"}{" "}
                    <span className="text-fg-muted">· {t(`org.roles.${w.role}` as TKey)}</span>
                  </span>
                  <span className="tabular">{w.open}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-fg-muted">
              {t("dash3.partnerSubs", { n: overview.data.partner_submissions })}
            </p>
            {["owner", "admin"].includes(role) && (
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/org/$id" params={{ id: picker.orgId! }}>
                    {t("dash3.manageWorkspace")}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/products">{t("dash3.products")}</Link>
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
