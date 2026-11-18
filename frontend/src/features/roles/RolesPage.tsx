import { Link } from "@tanstack/react-router";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, Page, PageHeader } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ACTIONS, ORG_ROLES, type Action, type OrgRole } from "@/lib/permissions";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { can } from "@/lib/permissions";

/** /roles — «الأدوار والصلاحيات»: the permission matrix (same source as the server) and the caller's role. */
export function RolesPage() {
  const { t } = useI18n();
  const picker = useOrgPicker();
  const role = picker.role as OrgRole | null;
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("rolesPage.title")} description={t("rolesPage.subtitle")} />
      <OrgSelect picker={picker} />
      {role && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span>
              {t("org.yourRole", { role: t(`org.roles.${role}` as never) })}{" "}
              <Badge>{t(`org.roles.${role}` as never)}</Badge>
            </span>
            <span className="text-sm text-fg-muted">{t(`rolesPage.desc.${role}` as never)}</span>
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
      <Card className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="permission-matrix">
          <thead>
            <tr className="text-fg-muted">
              <th className="p-2 text-start font-medium">{t("rolesPage.action")}</th>
              {ORG_ROLES.map((r) => (
                <th
                  key={r}
                  className={`p-2 text-center font-medium ${r === role ? "text-fg" : ""}`}
                  scope="col"
                >
                  {t(`org.roles.${r}` as never)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(ACTIONS) as Action[]).map((a) => (
              <tr key={a} className="border-t border-border">
                <th scope="row" className="p-2 text-start font-normal">
                  {t(`rolesPage.actions.${a}` as never)}
                </th>
                {ORG_ROLES.map((r) => {
                  const c = ACTIONS[a].cells[r];
                  const cond = (ACTIONS[a] as { condition_ar?: string }).condition_ar;
                  return (
                    <td key={r} className="p-2 text-center">
                      {c === "yes" ? (
                        <Check
                          className="mx-auto size-4 text-green"
                          aria-label={t("rolesPage.yes")}
                        />
                      ) : c === "cond" ? (
                        <span className="text-xs text-amber-text" title={cond}>
                          {t("rolesPage.cond")}
                        </span>
                      ) : (
                        <Minus
                          className="mx-auto size-4 text-fg-muted"
                          aria-label={t("rolesPage.no")}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 flex items-center gap-2 text-xs text-fg-muted">
          <ShieldCheck className="size-4" /> {t("rolesPage.serverNote")}
        </p>
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="font-bold">{t("rolesPage.conditions")}</h2>
        <ul className="list-disc ps-5 text-sm">
          {(Object.keys(ACTIONS) as Action[])
            .filter((a) => (ACTIONS[a] as { condition_ar?: string }).condition_ar)
            .map((a) => (
              <li key={a}>
                <strong>{t(`rolesPage.actions.${a}` as never)}:</strong>{" "}
                {(ACTIONS[a] as { condition_ar?: string }).condition_ar}
              </li>
            ))}
        </ul>
        <p className="text-sm text-fg-muted">{t("rolesPage.riskNote")}</p>
      </Card>
    </Page>
  );
}
