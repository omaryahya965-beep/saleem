// V2 completion §11.2 (D201): external partners and reviewers cannot read the organisation row (RLS), so /org
// showed «لا توجد مساحات». This lists the organisations they are authorised for from their OWN memberships and
// the links assigned to them (my_partner_links) — name, role, access status, links and open submissions — and
// nothing else of the organisation.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Handshake } from "lucide-react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { fetchMyMemberships } from "@/lib/api/features";
import { useMyPartnerLinks } from "@/lib/api/partners";

const EXTERNAL = new Set(["external_uploader", "external_reviewer"]);

export function PartnerOrgs({ memberOrgIds }: { memberOrgIds: string[] }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const mine = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: fetchMyMemberships,
    enabled: Boolean(user),
  });
  const external = (mine.data ?? []).filter(
    (m) => EXTERNAL.has(m.role) && !memberOrgIds.includes(m.org_id),
  );
  const links = useMyPartnerLinks(external.length > 0);
  if (!external.length) return null;
  return (
    <Card className="flex flex-col gap-3" data-testid="partner-orgs">
      <CardTitle className="flex items-center gap-2">
        <Handshake aria-hidden="true" className="size-5" />
        {t("partner3.title")}
      </CardTitle>
      <p className="text-sm text-fg-muted">{t("partner3.body")}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {external.map((m) => {
          const own = (links.data ?? []).filter((l) => l.org_id === m.org_id);
          const name = own[0]?.org_name ?? t("partner3.unnamed");
          const active = own.reduce((n, l) => Math.max(n, l.my_active ?? 0), 0);
          return (
            <li
              key={m.org_id}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <p className="flex items-center gap-2 text-lg font-bold" dir="auto">
                <Building2 aria-hidden="true" className="size-4 shrink-0" />
                {name}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{t(`org.roles.${m.role}` as TKey)}</Badge>
                <Badge variant={m.access_status === "active" ? "green" : "neutral"}>
                  {t(`partner3.access.${m.access_status === "active" ? "active" : "pending"}`)}
                </Badge>
                {m.role === "external_uploader" && (
                  <>
                    <Badge variant="outline">{t("partner3.links", { n: own.length })}</Badge>
                    <Badge variant="outline">{t("partner3.active", { n: active })}</Badge>
                  </>
                )}
              </div>
              {m.role === "external_uploader" && own.length === 0 && (
                <p className="text-sm text-fg-muted">{t("partner3.noLinks")}</p>
              )}
              <Button asChild size="sm" variant="secondary" className="self-start">
                <Link to="/dashboard">{t("partner3.open")}</Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
