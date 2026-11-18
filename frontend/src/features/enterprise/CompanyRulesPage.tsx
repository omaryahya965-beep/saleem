import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FlaskConical, ScrollText } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Field,
  Page,
  PageHeader,
  Select,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { flagOn } from "@/lib/api/flows";
import {
  tryRule,
  useInternalRules,
  useRuleVersions,
  useTryTargets,
  type TryResult,
} from "@/lib/api/internalRules";
import { useOrgSettings } from "@/lib/api/promotions";
import { can, type OrgRole } from "@/lib/permissions";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { InternalRulesCard } from "./InternalRulesCard";

const mmss = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** /company-rules — «قواعد الشركة»: versioned internal-policy rules, second-person approval, and «جرّب القاعدة». */
export function CompanyRulesPage() {
  const { t } = useI18n();
  const picker = useOrgPicker();
  const role = picker.role as OrgRole | null;
  const settings = useOrgSettings(picker.orgId);
  const on = flagOn(settings.data?.features, "internal_rules");
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader title={t("companyRules.title")} description={t("companyRules.subtitle")} />
      <OrgSelect picker={picker} />
      {!picker.orgId ? null : !can(role, "manage_company_rules") ? (
        <EmptyState icon={<ScrollText />} title={t("companyRules.managersOnly")} />
      ) : !on ? (
        <EmptyState
          icon={<ScrollText />}
          title={t("companyRules.flagOff")}
          action={
            can(role, "manage_settings") ? (
              <Button asChild size="sm">
                <Link to="/features">{t("nav.features")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <InternalRulesCard orgId={picker.orgId} />
          <TryRuleCard orgId={picker.orgId} />
          <VersionsCard orgId={picker.orgId} />
        </>
      )}
    </Page>
  );
}

function TryRuleCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const rules = useInternalRules(orgId);
  const targets = useTryTargets(orgId);
  const [ruleId, setRuleId] = useState("");
  const [sid, setSid] = useState("");
  const [res, setRes] = useState<TryResult | null>(null);
  const run = useMutation({
    mutationFn: () => tryRule(ruleId, sid),
    onSuccess: setRes,
    onError: () => toast.error(t("errors.generic")),
  });
  const target = (targets.data ?? []).find((x) => x.submissionId === sid);
  return (
    <Card className="flex flex-col gap-3" data-testid="try-rule">
      <CardTitle>{t("companyRules.tryTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("companyRules.tryHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("companyRules.rule")}>
          <Select value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
            <option value="">—</option>
            {(rules.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.title_ar}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("companyRules.target")}>
          <Select value={sid} onChange={(e) => setSid(e.target.value)}>
            <option value="">—</option>
            {(targets.data ?? []).map((x) => (
              <option key={x.submissionId} value={x.submissionId}>
                {x.title} — {t("companyRules.versionShort", { n: x.versionNo ?? 1 })}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div>
        <Button
          size="sm"
          icon={<FlaskConical />}
          disabled={!ruleId || !sid}
          loading={run.isPending}
          onClick={() => {
            setRes(null);
            run.mutate();
          }}
        >
          {t("companyRules.tryRun")}
        </Button>
      </div>
      {targets.data && targets.data.length === 0 && (
        <p className="text-sm text-fg-muted">{t("companyRules.noTargets")}</p>
      )}
      {res && (
        <div
          className="flex flex-col gap-2 rounded-md border border-border p-3"
          data-testid="try-result"
        >
          {res.status !== "done" ? (
            <p>{t(`companyRules.tryStatus.${res.status}` as never)}</p>
          ) : res.findings.length === 0 ? (
            <p>
              {res.result?.outcome === "unable_to_verify"
                ? t("companyRules.tryStatus.unable_to_verify")
                : t("companyRules.tryPassed")}
              {res.result?.reason ? ` — ${res.result.reason}` : ""}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {res.findings.map((f, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant={f.severity === "violation" ? "inverse" : "neutral"}>
                      {t("companyRules.internalPolicy")}
                    </Badge>
                    <span dir="auto">{f.explanation_ar}</span>
                  </span>
                  {f.evidence.quote && (
                    <q className="text-sm text-fg-muted" dir="auto">
                      {f.evidence.quote}
                    </q>
                  )}
                  {target && f.evidence.t_start != null && (
                    <Link
                      to="/promotions/$id"
                      params={{ id: target.promotionId }}
                      search={{ v: target.versionNo ?? undefined, t: f.evidence.t_start }}
                      className="text-sm underline"
                    >
                      {t("companyRules.jumpTo", { time: mmss(f.evidence.t_start) })}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-fg-muted">{t("companyRules.tryNotSaved")}</p>
        </div>
      )}
    </Card>
  );
}

function VersionsCard({ orgId }: { orgId: string }) {
  const { t, formatDate } = useI18n();
  const versions = useRuleVersions(orgId);
  if (!versions.data?.length) return null;
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>{t("companyRules.history")}</CardTitle>
      <ul className="flex flex-col gap-1 text-sm">
        {versions.data.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2">
            <Badge mono>{v.code}</Badge>
            <Badge variant="outline">{t("companyRules.version", { n: v.version })}</Badge>
            <span dir="auto">{v.title_ar}</span>
            <span className="text-fg-muted">
              {t("companyRules.approvedAt", { date: formatDate(v.approved_at) })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
