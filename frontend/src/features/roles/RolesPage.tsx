// /roles — «الأدوار والصلاحيات» (V2 completion §5, D195): the caller's role, the nine roles (primary vs additional —
// a display grouping that never changes authority) with descriptions that match backend enforcement, member counts
// and enabled state, and a searchable permission matrix by functional area with text + icon cells (not colour only).
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleDot, Search, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, CardTitle, Page, PageHeader } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { ORG_ROLES, can, type Cell, type OrgRole } from "@/lib/permissions";
import { getEnabledRoles } from "@/lib/roleConfig";
import { supabase } from "@/lib/supabase";
import { useOrgSettings } from "@/lib/api/promotions";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { cn } from "@/lib/utils";
import { OrgRolesConfigCard } from "./OrgRolesConfigCard";
import { ADDITIONAL_ROLES, AREAS, PRIMARY_ROLES, rowOf } from "./catalogue";

const ICON: Record<Cell, React.ReactNode> = {
  yes: <Check aria-hidden="true" className="size-4" />,
  cond: <CircleDot aria-hidden="true" className="size-4" />,
  no: <X aria-hidden="true" className="size-4" />,
};

export function RolesPage() {
  const { t } = useI18n();
  const picker = useOrgPicker();
  const role = picker.role as OrgRole | null;
  const settings = useOrgSettings(picker.orgId || null);
  const counts = useQuery({
    queryKey: ["role-counts", picker.orgId],
    enabled: Boolean(picker.orgId),
    queryFn: async () =>
      ((
        await (supabase.rpc as unknown as (f: string, a: object) => PromiseLike<{ data: unknown }>)(
          "role_member_counts",
          { _org: picker.orgId },
        )
      ).data ?? {}) as Record<string, number>,
  });
  const enabled = getEnabledRoles(
    (settings.data?.features as Record<string, unknown> | null) ?? null,
    [],
  );
  const [q, setQ] = useState("");
  const [area, setArea] = useState("all");
  const [focus, setFocus] = useState<OrgRole | "all">("all");
  const term = q.trim().toLowerCase();
  const roleCard = (r: OrgRole) => (
    <li key={r}>
      <button
        type="button"
        onClick={() => setFocus((x) => (x === r ? "all" : r))}
        aria-pressed={focus === r}
        className={cn(
          "flex h-full w-full flex-col gap-1 rounded-lg border p-3 text-start",
          focus === r ? "border-ink bg-sunken" : "border-border bg-surface hover:bg-sunken",
          r === role && "ring-2 ring-green/40",
        )}
        data-testid={`role-card-${r}`}
      >
        <span className="flex flex-wrap items-center gap-1.5 font-bold">
          {t(`org.roles.${r}` as TKey)}
          {r === role && <Badge>{t("roles2.you")}</Badge>}
          <Badge variant={enabled.includes(r) ? "outline" : "neutral"}>
            {enabled.includes(r) ? t("rolesConfig.enabledBadge") : t("rolesConfig.disabledBadge")}
          </Badge>
        </span>
        <span className="text-sm text-fg-muted">{t(`roles2.desc.${r}` as TKey)}</span>
        <span className="mt-auto text-xs text-fg-muted">
          {t("roles2.members", { n: counts.data?.[r] ?? 0 })}
        </span>
      </button>
    </li>
  );
  const shownRoles = focus === "all" ? [...ORG_ROLES] : [focus];
  return (
    <Page wide className="flex flex-col gap-6">
      <PageHeader title={t("rolesPage.title")} description={t("roles2.subtitle")} />
      <OrgSelect picker={picker} />
      {role && (
        <Card className="flex flex-wrap items-center justify-between gap-3" data-testid="my-role">
          <div className="flex flex-col gap-1">
            <span className="font-bold">
              {t("org.yourRole", { role: t(`org.roles.${role}` as TKey) })}
            </span>
            <span className="text-sm text-fg-muted">{t(`roles2.desc.${role}` as TKey)}</span>
          </div>
          {can(role, "manage_members") ? (
            <Button asChild size="sm">
              <Link to="/org/$id" params={{ id: picker.orgId }}>
                {t("rolesPage.manageMembers")}
              </Link>
            </Button>
          ) : (
            <span className="text-sm text-fg-muted" data-testid="members-disabled">
              {t("rolesPage.membersOwnerAdmin")}
            </span>
          )}
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{t("roles2.primary")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{PRIMARY_ROLES.map(roleCard)}</ul>
        <h2 className="mt-2 text-lg font-bold">{t("roles2.additional")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {ADDITIONAL_ROLES.map(roleCard)}
        </ul>
        <p className="text-xs text-fg-muted">{t("roles2.groupingNote")}</p>
      </section>

      {picker.orgId && <OrgRolesConfigCard orgId={picker.orgId} myRole={role} />}

      <Card className="flex flex-col gap-3">
        <CardTitle>{t("roles2.matrix")}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <span className="sr-only">{t("roles2.search")}</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("roles2.search")}
              className="h-9 rounded-md border border-border bg-surface ps-8 pe-3 text-sm"
            />
          </label>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
            aria-label={t("roles2.area")}
          >
            <option value="all">{t("roles2.allAreas")}</option>
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {t(`roles2.areas.${a.key}` as TKey)}
              </option>
            ))}
          </select>
          {focus !== "all" && (
            <Button size="sm" variant="ghost" onClick={() => setFocus("all")}>
              {t("roles2.allRoles")}
            </Button>
          )}
          <span className="ms-auto flex flex-wrap gap-3 text-xs text-fg-muted">
            {(["yes", "cond", "no"] as const).map((c) => (
              <span key={c} className="inline-flex items-center gap-1">
                {ICON[c]}
                {t(`rolesPage.${c}` as TKey)}
              </span>
            ))}
          </span>
        </div>
        {/* relative: the sr-only labels (position:absolute) must stay inside the scroller, else they widen the page. */}
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm" data-testid="permission-matrix">
            <thead>
              <tr className="text-fg-muted">
                <th className="p-2 text-start font-medium">{t("rolesPage.action")}</th>
                {shownRoles.map((r) => (
                  <th
                    key={r}
                    className={cn("p-2 text-center font-medium", r === role && "text-fg")}
                  >
                    {t(`org.roles.${r}` as TKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AREAS.filter((a) => area === "all" || a.key === area).map((a) => {
                const rows = a.actions
                  .map((k) => ({ k, row: rowOf(k), label: t(`roles2.action.${k}` as TKey) }))
                  .filter(
                    (x) =>
                      !term ||
                      x.label.toLowerCase().includes(term) ||
                      t(`roles2.areas.${a.key}` as TKey)
                        .toLowerCase()
                        .includes(term),
                  );
                if (!rows.length) return null;
                return [
                  <tr key={a.key} className="bg-sunken">
                    <th
                      colSpan={shownRoles.length + 1}
                      className="p-2 text-start text-xs font-bold tracking-wide"
                    >
                      {t(`roles2.areas.${a.key}` as TKey)}
                    </th>
                  </tr>,
                  ...rows.map(({ k, row, label }) => (
                    <tr key={k} className="border-t border-border">
                      <th scope="row" className="p-2 text-start font-normal">
                        <span className="block">{label}</span>
                        <span className="block text-xs text-fg-muted" dir="ltr">
                          {row.enforcedBy}
                        </span>
                      </th>
                      {shownRoles.map((r) => {
                        const c = row.cells[r];
                        const cond = row.conditionKey
                          ? t(`roles2.cond.${row.conditionKey}` as TKey)
                          : row.conditionAr;
                        return (
                          <td
                            key={r}
                            className={cn(
                              "p-2 text-center",
                              c === "yes"
                                ? "text-green"
                                : c === "cond"
                                  ? "text-amber-text"
                                  : "text-fg-muted",
                              r === role && "bg-green-bg/30",
                            )}
                            title={c === "cond" ? cond : undefined}
                          >
                            <span className="inline-flex items-center gap-1">
                              {ICON[c]}
                              <span className="sr-only">{t(`rolesPage.${c}` as TKey)}</span>
                              {c === "cond" && focus !== "all" && (
                                <span className="text-xs">{cond}</span>
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">{t("roles2.conditionsTitle")}</summary>
          <ul className="mt-2 flex flex-col gap-1 text-fg-muted">
            {(
              [
                "own_ad",
                "decider",
                "self_approval",
                "own_ad_fix",
                "readers_only",
                "own_claims",
                "not_author",
              ] as const
            ).map((k) => (
              <li key={k}>
                <span className="font-medium text-fg">{t(`roles2.condTitle.${k}` as TKey)}: </span>
                {t(`roles2.cond.${k}` as TKey)}
              </li>
            ))}
          </ul>
        </details>
        <p className="text-xs text-fg-muted">{t("rolesPage.serverNote")}</p>
      </Card>
    </Page>
  );
}
