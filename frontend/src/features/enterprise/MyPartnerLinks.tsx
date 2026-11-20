// Partner dashboard (V2 upgrade §27.4, D174): the submission links assigned to this partner, per organisation,
// with campaign, instructions excerpt, active count and their own advertisements. Nothing of other partners.
import { Link } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useMyPartnerLinks } from "@/lib/api/partners";

export function MyPartnerLinks() {
  const { t } = useI18n();
  const links = useMyPartnerLinks();
  if (!links.data?.length) return null;
  return (
    <Card className="flex flex-col gap-3" data-testid="my-partner-links">
      <CardTitle className="flex items-center gap-2">
        <Handshake aria-hidden="true" className="size-5" />
        {t("partner2.myLinks")}
      </CardTitle>
      <ul className="grid gap-3 md:grid-cols-2">
        {links.data.map((l) => (
          <li
            key={l.id}
            className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold" dir="auto">
                {l.org_name} · {l.label}
              </span>
              <Badge variant="outline">
                {t("partner2.activeValue", { n: l.my_active ?? 0, max: l.max_active ?? 5 })}
              </Badge>
            </div>
            {l.campaign && (
              <p className="text-fg-muted">
                {t("partner2.campaign")}: {l.campaign.name}
              </p>
            )}
            {l.instructions_ar && (
              <p className="line-clamp-2 text-fg-muted" dir="auto">
                {l.instructions_ar}
              </p>
            )}
            {(l.my_submissions ?? []).slice(0, 3).map((s) => (
              <Link
                key={s.id}
                to="/promotions/$id"
                params={{ id: s.id }}
                className="flex items-center justify-between gap-2 underline-offset-4 hover:underline"
              >
                <span dir="auto" className="truncate">
                  {s.title}
                </span>
                <Badge>{t(`promo.reviewStatus.${s.review_status}` as TKey)}</Badge>
              </Link>
            ))}
            <Button asChild size="sm" className="self-start">
              <Link to="/partner/link/$id" params={{ id: l.id! }}>
                {t("partner2.openLink")}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
