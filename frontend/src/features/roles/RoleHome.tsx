import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui";
import { useI18n } from "@/i18n";
import { cell, conditionOf, type Action, type OrgRole } from "@/lib/permissions";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";

type Shortcut = { key: string; to: string; action: Action };
const SHORTCUTS: Record<string, Shortcut> = {
  new: { key: "new", to: "/new", action: "create_promotion" },
  promotions: { key: "promotions", to: "/promotions", action: "view_promotions" },
  queue: { key: "queue", to: "/queue", action: "decide_review" },
  legal: { key: "legal", to: "/legal", action: "legal_opinion" },
  analytics: { key: "analytics", to: "/analytics", action: "view_analytics" },
  rules: { key: "rules", to: "/rules", action: "manage_rule_packs" },
  features: { key: "features", to: "/features", action: "manage_settings" },
  roles: { key: "roles", to: "/roles", action: "manage_members" },
};
/** What each role sees first. The rest follow, disabled with the reason when the role cannot use them. */
const ORDER: Record<OrgRole, string[]> = {
  owner: ["roles", "features", "queue", "analytics"],
  admin: ["roles", "features", "queue", "analytics"],
  compliance_lead: ["queue", "rules", "analytics", "promotions"],
  reviewer: ["queue", "promotions", "analytics"],
  legal: ["legal", "promotions"],
  creator: ["new", "promotions"],
  external_uploader: ["promotions", "new"],
  external_reviewer: ["promotions"],
  viewer: ["promotions", "analytics"],
};

/** The role's home: its main tasks first; actions the role cannot take are shown disabled with the reason. */
export function RoleHome() {
  const { t } = useI18n();
  const picker = useOrgPicker();
  const role = picker.role as OrgRole | null;
  if (!picker.orgs.data?.length || !role) return null;
  const first = ORDER[role] ?? [];
  const keys = [...first, ...Object.keys(SHORTCUTS).filter((k) => !first.includes(k))];
  return (
    <Card className="flex flex-col gap-3" data-testid="role-home">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{t(`roleHome.title.${role}` as never)}</h2>
          <p className="text-sm text-fg-muted">{t(`rolesPage.desc.${role}` as never)}</p>
        </div>
        {picker.orgs.data.length > 1 && <OrgSelect picker={picker} />}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {keys.map((k) => {
          const s = SHORTCUTS[k]!;
          const c = cell(role, s.action);
          const label = t(`roleHome.shortcut.${k}` as never);
          return (
            <li key={k}>
              {c === "no" ? (
                <div
                  className="flex h-full flex-col gap-1 rounded-md border border-dashed border-border p-3 text-fg-muted"
                  aria-disabled="true"
                  data-testid={`shortcut-${k}-disabled`}
                >
                  <span className="font-medium">{label}</span>
                  <span className="text-xs">
                    {t("roleHome.notAllowed", { role: t(`org.roles.${role}` as never) })}
                  </span>
                </div>
              ) : (
                <Link
                  to={s.to}
                  className="flex h-full flex-col gap-1 rounded-md border border-border p-3 hover:bg-surface-2"
                  data-testid={`shortcut-${k}`}
                >
                  <span className="font-medium">{label}</span>
                  {c === "cond" && (
                    <span className="text-xs text-fg-muted">{conditionOf(s.action)}</span>
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
