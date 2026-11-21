// Information tab sections added in the V2 completion (§9, D191): product and campaign details, the declarations
// stored on the selected version (immutable snapshot), the Mawthooq manual check, supporting documentation,
// deadlines, the latest decision and outstanding conditions. Read-only facts are marked as such.
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Badge, Card, CardTitle } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Promotion, PromotionBundle, VersionSummary } from "@/lib/api/promotions";
import { fetchConditions, fetchHistory, rk } from "@/lib/api/review";
import { LicenseCheck } from "./LicenseCheck";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words" dir="auto">
        {children}
      </dd>
    </div>
  );
}
function Box({
  title,
  snapshot,
  children,
}: {
  title: string;
  snapshot?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Card className="flex flex-col gap-1">
      <CardTitle className="flex items-center justify-between gap-2">
        {title}
        {snapshot && (
          <Badge variant="neutral">
            <Lock aria-hidden="true" className="me-1 inline size-3" />
            {t("info2.snapshot")}
          </Badge>
        )}
      </CardTitle>
      <dl className="divide-y divide-border">{children}</dl>
    </Card>
  );
}

export function ProductCampaignSections({ bundle }: { bundle: PromotionBundle }) {
  const { t, lang, formatDate } = useI18n();
  const pr = bundle.product;
  const c = bundle.campaign as
    (PromotionBundle["campaign"] & { starts_on?: string | null; ends_on?: string | null }) | null;
  const facts = (pr?.key_facts ?? {}) as Record<string, Record<string, string> | unknown>;
  const attrs = Object.values(facts).find(
    (v) => v && typeof v === "object" && !Array.isArray(v) && !("value" in (v as object)),
  ) as Record<string, string> | undefined;
  return (
    <>
      <Box title={t("info2.product")}>
        {pr ? (
          <>
            <Row label={t("products.nameAr")}>{(lang === "en" && pr.name_en) || pr.name_ar}</Row>
            <Row label={t("ws.info.sector")}>{t(`ws.sector.${pr.sector}` as TKey)}</Row>
            <Row label={t("ws.info.productType")}>
              {t(`ws.productType.${pr.product_type}` as TKey)}
            </Row>
            <Row label={t("products.regulator")}>
              {t(`products.regulatorOpt.${pr.regulator}` as TKey)}
            </Row>
            <Row label={t("info2.productStatus")}>{t(`products.status.${pr.status}` as TKey)}</Row>
            {attrs &&
              Object.entries(attrs)
                .slice(0, 6)
                .map(([k, v]) => (
                  <Row key={k} label={t(`prod2.field.${k}` as TKey)}>
                    {String(v)}
                  </Row>
                ))}
          </>
        ) : (
          <Row label={t("promo.product")}>{t("promo.noProduct")}</Row>
        )}
      </Box>
      <Box title={t("info2.campaign")}>
        {c ? (
          <>
            <Row label={t("info2.campaignName")}>{c.name}</Row>
            <Row label={t("info2.brand")}>{c.brand ?? t("common.none")}</Row>
            {(c.starts_on || c.ends_on) && (
              <Row label={t("info2.period")}>
                {c.starts_on ? formatDate(c.starts_on) : "—"} –{" "}
                {c.ends_on ? formatDate(c.ends_on) : "—"}
              </Row>
            )}
          </>
        ) : (
          <Row label={t("ws.header.campaign")}>{t("common.none")}</Row>
        )}
      </Box>
    </>
  );
}

/** Declarations recorded with the version (never edited afterwards). */
export function DeclarationsSection({
  promotion: p,
  version,
  canCheckLicense,
}: {
  promotion: Promotion;
  version: VersionSummary | null;
  canCheckLicense: boolean;
}) {
  const { t, formatDate } = useI18n();
  const sub = useQuery({
    queryKey: ["version-declarations", version?.id],
    enabled: Boolean(version),
    queryFn: async () =>
      (
        await supabase
          .from("submissions")
          .select(
            "is_paid_ad, has_written_contract, ai_used, mawthooq_license_no, platform, kind, created_at, duration_seconds",
          )
          .eq("id", version!.id)
          .maybeSingle()
      ).data,
  });
  const yn = (b: boolean | null | undefined) =>
    b == null ? "—" : b ? t("common.yes") : t("common.no");
  const s = sub.data;
  return (
    <Box title={t("info2.declarations", { n: version?.version_no ?? "—" })} snapshot>
      <Row label={t("newCheck.paidAd")}>{yn(s?.is_paid_ad)}</Row>
      <Row label={t("newCheck.aiUsed")}>{yn(s?.ai_used)}</Row>
      <Row label={t("newCheck.contract")}>{yn(s?.has_written_contract)}</Row>
      <Row label={t("info2.uploaded")}>{s?.created_at ? formatDate(s.created_at, true) : "—"}</Row>
      <Row label={t("info2.mawthooq")}>
        <LicenseCheck promotion={p} canCheck={canCheckLicense} />
      </Row>
    </Box>
  );
}

/** Reviewer, deadlines, the latest decision and the outstanding conditions. */
export function WorkflowSection({
  promotion: p,
  versions,
  person,
}: {
  promotion: Promotion;
  versions: VersionSummary[];
  person: (id: string | null | undefined, empty?: string) => string;
}) {
  const { t, formatDate } = useI18n();
  const history = useQuery({
    queryKey: rk.history(p.id),
    queryFn: () =>
      fetchHistory(
        p.id,
        versions.map((v) => v.id),
      ),
    enabled: Boolean(p.org_id),
  });
  const conditions = useQuery({
    queryKey: rk.conditions(p.id),
    queryFn: () => fetchConditions(p.id),
    enabled: Boolean(p.org_id),
  });
  const last = [...(history.data?.decisions ?? [])]
    .reverse()
    .find((d) => d.decision !== "escalate" && d.decision !== "legal_response");
  const open = (conditions.data ?? []).filter(
    (c) => c.submission_id === p.current_version_id && c.status !== "verified",
  );
  const overdue = p.deadline_at && new Date(p.deadline_at) < new Date();
  return (
    <Box title={t("ws.info.workflow")}>
      <Row label={t("ws.header.humanStatus")}>
        {t(`promo.reviewStatus.${p.review_status}` as TKey)}
      </Row>
      <Row label={t("ws.header.assignee")}>{person(p.assigned_reviewer_id)}</Row>
      <Row label={t("promo.deadline")}>
        {p.deadline_at ? (
          <span className={overdue ? "text-red" : ""}>{formatDate(p.deadline_at)}</span>
        ) : (
          t("common.none")
        )}
      </Row>
      <Row label={t("ws.header.submitted")}>
        {p.submitted_at ? formatDate(p.submitted_at, true) : t("common.none")}
      </Row>
      <Row label={t("info2.lastDecision")}>
        {last ? (
          <>
            {t(`review.decision.${last.decision}` as TKey)} · {formatDate(last.created_at, true)} ·{" "}
            {person(last.actor_id, t(`org.roles.${last.actor_role}` as TKey))}
            {last.comment && <span className="block text-sm text-fg-muted">{last.comment}</span>}
          </>
        ) : (
          t("common.none")
        )}
      </Row>
      <Row label={t("info2.openConditions")}>
        {open.length ? (
          <ul className="list-inside list-disc text-sm">
            {open.map((c) => (
              <li key={c.id}>
                {c.description}{" "}
                <Badge variant="neutral">{t(`ws.cond.status.${c.status}` as TKey)}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          t("common.none")
        )}
      </Row>
      <Row label={t("promo.reviewerNotes")}>{p.reviewer_notes || t("common.none")}</Row>
    </Box>
  );
}
