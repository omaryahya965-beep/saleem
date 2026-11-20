// Role-specific work overview on the dashboard (V2 upgrade §20, D185). Counts come from the advertisements the
// caller may read in the active workspace (RLS): managers see the organisation, a reviewer sees their assigned
// cases, a marketer their own advertisements, a partner its submissions. No organisation analytics are exposed.
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  review_status: string;
  assigned_reviewer_id: string | null;
  owner_id: string | null;
  deadline_at: string | null;
};
type Tile = { key: string; n: number; to: "/queue" | "/promotions"; tone?: "red" | "amber" };

export function RoleWorkload() {
  const { t } = useI18n();
  const { user } = useAuth();
  const picker = useOrgPicker();
  const role = picker.role;
  const q = useQuery({
    queryKey: ["role-workload", picker.orgId, user?.id],
    enabled: Boolean(
      picker.orgId && user && role && role !== "legal" && role !== "external_reviewer",
    ),
    queryFn: async () =>
      ((
        await supabase
          .from("promotions")
          .select("id, review_status, assigned_reviewer_id, owner_id, deadline_at")
          .eq("org_id", picker.orgId!)
          .limit(1000)
      ).data ?? []) as Row[],
  });
  if (!q.data || !role || !user) return null;
  const rows = q.data;
  const by = (s: string, f: (r: Row) => boolean = () => true) =>
    rows.filter((r) => r.review_status === s && f(r)).length;
  const open = new Set(["pending_review", "in_review", "escalated"]);
  const overdue = rows.filter(
    (r) => r.deadline_at && new Date(r.deadline_at) < new Date() && open.has(r.review_status),
  ).length;
  const mine = (r: Row) => r.owner_id === user.id;
  const assignedToMe = (r: Row) => r.assigned_reviewer_id === user.id;
  let tiles: Tile[];
  if (["owner", "admin", "compliance_lead", "viewer"].includes(role))
    tiles = [
      { key: "awaiting", n: by("pending_review"), to: "/queue" },
      {
        key: "unassigned",
        n: rows.filter((r) => open.has(r.review_status) && !r.assigned_reviewer_id).length,
        to: "/queue",
        tone: "amber",
      },
      { key: "in_review", n: by("in_review"), to: "/queue" },
      { key: "changes", n: by("changes_requested"), to: "/promotions" },
      { key: "conditional", n: by("conditionally_approved"), to: "/promotions" },
      { key: "approved", n: by("approved"), to: "/promotions" },
      { key: "rejected", n: by("rejected"), to: "/promotions" },
      { key: "overdue", n: overdue, to: "/queue", tone: "red" },
    ];
  else if (role === "reviewer")
    tiles = [
      {
        key: "assigned",
        n: rows.filter((r) => assignedToMe(r) && r.review_status === "pending_review").length,
        to: "/queue",
      },
      { key: "in_review", n: by("in_review", assignedToMe), to: "/queue" },
      { key: "verify", n: by("conditionally_approved", assignedToMe), to: "/promotions" },
      {
        key: "overdue",
        n: rows.filter(
          (r) =>
            assignedToMe(r) &&
            r.deadline_at &&
            new Date(r.deadline_at) < new Date() &&
            open.has(r.review_status),
        ).length,
        to: "/queue",
        tone: "red",
      },
    ];
  else
    tiles = [
      { key: "drafts", n: by("draft", mine), to: "/promotions" },
      {
        key: "waiting",
        n: rows.filter((r) => mine(r) && open.has(r.review_status)).length,
        to: "/promotions",
      },
      { key: "changes", n: by("changes_requested", mine), to: "/promotions", tone: "amber" },
      {
        key: "conditional",
        n: by("conditionally_approved", mine),
        to: "/promotions",
        tone: "amber",
      },
      { key: "approved", n: by("approved", mine), to: "/promotions" },
    ];
  return (
    <Card className="flex flex-col gap-3" data-testid="role-workload">
      <h2 className="text-lg font-bold">{t("dash2.title")}</h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((x) => (
          <li key={x.key}>
            <Link to={x.to} className="flex flex-col rounded-md bg-sunken p-3 hover:bg-line/40">
              <span
                className={cn(
                  "tabular text-2xl font-bold",
                  x.n > 0 && x.tone === "red" && "text-red",
                  x.n > 0 && x.tone === "amber" && "text-amber-text",
                )}
              >
                {x.n}
              </span>
              <span className="text-sm text-fg-muted">{t(`dash2.tile.${x.key}` as TKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
