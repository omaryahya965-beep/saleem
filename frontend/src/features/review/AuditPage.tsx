import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { downloadFile, fetchMyOrgs } from "@/lib/api/features";
import { fetchAudit, toCsv } from "@/lib/api/review";
import { bothCalendars } from "./model";

const EVENT_TYPES = [
  "created",
  "version_added",
  "analysis_done",
  "analysis_failed",
  "submitted",
  "opened",
  "assigned",
  "decided",
  "escalated",
  "legal_responded",
  "archived",
];

/** /audit — review events of a workspace, for owners and admins (05_UX_SPEC §3). */
export function AuditPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  const managed = (orgs.data ?? []).filter((o) =>
    o.org_members.some((m) => m.user_id === user?.id && (m.role === "owner" || m.role === "admin")),
  );
  const [orgId, setOrgId] = useState("");
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    if (!orgId && managed[0]) setOrgId(managed[0].id);
  }, [managed, orgId]);
  const audit = useQuery({
    queryKey: ["audit", orgId, eventType, from, to],
    queryFn: () => fetchAudit({ orgId, eventType, from, to }),
    enabled: Boolean(orgId),
  });
  const members = new Map(
    (managed.find((o) => o.id === orgId)?.org_members ?? []).map((m) => [
      m.user_id,
      m.display_name || m.email || m.user_id,
    ]),
  );
  const label = (type: string) => {
    const k = `review.history.event.${type}` as TKey;
    const v = t(k);
    return v === k ? type : v;
  };
  const exportCsv = () =>
    downloadFile(
      `saleem-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        (audit.data ?? []).map((e) => ({
          created_at: e.created_at,
          event: e.event_type,
          promotion_id: e.promotion_id,
          submission_id: e.submission_id,
          actor: e.actor_id ? (members.get(e.actor_id) ?? e.actor_id) : "",
          from_status: e.from_status,
          to_status: e.to_status,
          payload: e.payload,
        })),
      ),
      "text/csv;charset=utf-8",
    );

  if (orgs.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  if (!managed.length)
    return (
      <Page narrow>
        <EmptyState
          icon={<ScrollText />}
          title={t("review.audit.title")}
          body={t("review.audit.onlyManagers")}
        />
      </Page>
    );
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("review.audit.title")}
        description={t("review.audit.subtitle")}
        actions={
          <Button
            variant="secondary"
            icon={<Download />}
            disabled={!audit.data?.length}
            onClick={exportCsv}
          >
            {t("review.audit.export")}
          </Button>
        }
      />
      <Card className="grid gap-4 sm:grid-cols-4">
        {managed.length > 1 && (
          <Field label={t("products.pickOrg")}>
            <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {managed.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("review.audit.eventType")}>
          <Select value={eventType} onChange={(e) => setEventType(e.target.value)}>
            <option value="">{t("promo.allOption")}</option>
            {EVENT_TYPES.map((e) => (
              <option key={e} value={e}>
                {label(e)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("review.audit.from")}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("review.audit.to")}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </Card>
      {audit.isPending ? (
        <Skeleton className="h-32 w-full rounded-lg" />
      ) : !audit.data?.length ? (
        <EmptyState icon={<ScrollText />} title={t("review.audit.empty")} />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
          data-testid="audit-list"
        >
          {audit.data.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium text-fg">{label(e.event_type)}</span>
              <span className="text-fg-muted">
                {e.actor_id ? (members.get(e.actor_id) ?? "—") : "—"}
              </span>
              <Link
                to="/promotions/$id"
                params={{ id: e.promotion_id }}
                className="text-green hover:underline"
              >
                {t("review.audit.promotion")}
              </Link>
              <span className="text-xs text-fg-muted">{bothCalendars(e.created_at, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
