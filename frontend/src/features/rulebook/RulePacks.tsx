import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Skeleton,
  Switch,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { applicabilityLines } from "./model";
import { OverridesCard } from "@/features/libraries/OverridesCard";
import { useAuth } from "@/lib/api/auth";
import type { Rule } from "@/lib/api/data";
import { fetchMyOrgs } from "@/lib/api/features";
import { useIsAdmin } from "@/lib/api/roles";
import { dbErrorCode, useOrgSettings } from "@/lib/api/promotions";
import {
  packEnabled,
  setOrgRulePack,
  setRuleReviewState,
  useOrgPacks,
  usePacks,
  useSources,
  type RulePack,
  type Source,
} from "@/lib/api/rules";

function RuleDetail({
  rule,
  source,
  showInternals,
  canChangeState,
}: {
  rule: Rule;
  source: Source | undefined;
  showInternals: boolean;
  canChangeState: boolean;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const app = applicabilityLines((rule.applicability ?? {}) as Record<string, unknown>, t);
  return (
    <li className="flex flex-col gap-2 border-t border-border py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge mono>{rule.code}</Badge>
        <span className="font-medium text-fg">{lang === "en" ? rule.title_en : rule.title_ar}</span>
        <Badge>{t(`rulebook2.state.${rule.review_state}` as TKey)}</Badge>
        {rule.article_ref && (
          <span className="text-xs text-fg-muted">
            {t("findingType.article")} <bdi>{rule.article_ref}</bdi>
          </span>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-green">{t("rulebook2.ruleDetail")}</summary>
        <dl className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr]">
          <dt className="text-fg-muted">{t("rulebook2.summary")}</dt>
          <dd className="text-fg">
            {(lang === "en" ? rule.summary_en : rule.summary_ar) ?? rule.description_ar}
          </dd>
          <dt className="text-fg-muted">{t("rulebook2.applicability")}</dt>
          <dd className="text-fg">
            {app.length ? app.map((l) => <p key={l}>{l}</p>) : t("rulebook2.applicabilityAny")}
          </dd>
          {rule.content_triggers.length > 0 && (
            <>
              <dt className="text-fg-muted">{t("rulebook2.triggers")}</dt>
              <dd className="text-fg">
                {rule.content_triggers.map((s) => t(`report2.signal.${s}` as TKey)).join("، ")}
              </dd>
            </>
          )}
          {rule.check_kind && (
            <>
              <dt className="text-fg-muted">{t("rulebook2.checkKind")}</dt>
              <dd className="text-fg">{t(`rulebook2.checkKindOpt.${rule.check_kind}` as TKey)}</dd>
            </>
          )}
          {rule.deterministic_check && (
            <>
              <dt className="text-fg-muted">{t("rulebook2.deterministicKey")}</dt>
              <dd dir="ltr" className="text-start font-mono text-xs text-fg rtl:text-end">
                {rule.deterministic_check}
              </dd>
            </>
          )}
          {showInternals && (
            <>
              <dt className="text-fg-muted">{t("rulebook2.modelInstruction")}</dt>
              <dd dir="ltr" className="text-start text-xs text-fg rtl:text-end">
                {rule.llm_instructions}
              </dd>
            </>
          )}
          <dt className="text-fg-muted">{t("rulebook2.source")}</dt>
          <dd className="flex flex-wrap items-center gap-2 text-fg">
            {source ? (
              <>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-green hover:underline"
                >
                  {lang === "en" ? (source.title_en ?? source.title_ar) : source.title_ar}
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </a>
                <Badge>{t(`findingType.verification.${source.verification}` as TKey)}</Badge>
              </>
            ) : rule.pack === "sa-system" ? (
              t("findingType.verification.internal")
            ) : (
              (lang === "en" ? rule.source_name_en : null) || rule.source_name
            )}
          </dd>
        </dl>
        {canChangeState && (
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
            {t("rulebook2.changeState")}
          </Button>
        )}
      </details>
      {open && <ReviewStateDialog rule={rule} onClose={() => setOpen(false)} />}
    </li>
  );
}

function ReviewStateDialog({ rule, onClose }: { rule: Rule; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [state, setState] = useState(rule.review_state);
  const [reason, setReason] = useState("");
  const [official, setOfficial] = useState(rule.official_text_ar ?? "");
  const [reviewer, setReviewer] = useState("");
  const save = useMutation({
    mutationFn: () =>
      setRuleReviewState({ rule: rule.id, state, reason, officialText: official, reviewer }),
    onSuccess: () => {
      toast.success(t("rulebook2.stateSaved"));
      void qc.invalidateQueries({ queryKey: ["rulebook"] });
      onClose();
    },
    onError: (e) => toast.error(t(`rulebook2.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${t("rulebook2.changeState")} · ${rule.code}`}
      description={t("rulebook2.activationGuard")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("rulebook2.reviewState")}>
          <Select value={state} onChange={(e) => setState(e.target.value)}>
            {["draft", "legal_review", "active", "archived"].map((s) => (
              <option key={s} value={s}>
                {t(`rulebook2.state.${s}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("rulebook2.reason")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" />
        </Field>
        {state === "active" && (
          <>
            <Field label={t("rulebook2.officialText")}>
              <Textarea
                rows={4}
                value={official}
                onChange={(e) => setOfficial(e.target.value)}
                dir="rtl"
              />
            </Field>
            <Field label={t("rulebook2.reviewer")}>
              <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} dir="auto" />
            </Field>
          </>
        )}
      </div>
    </Dialog>
  );
}

function OrgPackSettings({ packs }: { packs: RulePack[] }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  const managed = (orgs.data ?? []).filter((o) =>
    o.org_members.some((m) => m.user_id === user?.id && (m.role === "owner" || m.role === "admin")),
  );
  const [orgId, setOrgId] = useState("");
  useEffect(() => {
    if (!orgId && managed[0]) setOrgId(managed[0].id);
  }, [managed, orgId]);
  const rows = useOrgPacks(orgId);
  const settings = useOrgSettings(orgId || null);
  const save = useMutation({
    mutationFn: (v: { pack: string; enabled: boolean; drafts: boolean }) =>
      setOrgRulePack(orgId, v.pack, v.enabled, v.drafts),
    onSuccess: () => {
      toast.success(t("rulebook2.saved"));
      void qc.invalidateQueries({ queryKey: ["org-rule-packs", orgId] });
    },
    onError: (e) => toast.error(t(`rulebook2.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey)),
  });
  if (!managed.length) return null;
  return (
    <Card className="flex flex-col gap-4" data-testid="org-pack-settings">
      <CardTitle>{t("rulebook2.orgTitle")}</CardTitle>
      {managed.length > 1 && (
        <Field label={t("rulebook2.orgPick")} className="max-w-sm">
          <Select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
            {managed.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {rows.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="divide-y divide-border">
          {packs.map((p) => {
            const row = rows.data?.find((r) => r.pack_code === p.code);
            const enabled = packEnabled(p, row, settings.data?.sector ?? null);
            const drafts = Boolean(row?.include_draft_rules);
            return (
              <li key={p.code} className="flex flex-col gap-1 py-2">
                <Switch
                  checked={enabled}
                  disabled={p.always_enabled || save.isPending}
                  onCheckedChange={(v) => save.mutate({ pack: p.code, enabled: v, drafts })}
                  label={lang === "en" ? p.name_en : p.name_ar}
                  hint={p.always_enabled ? t("rulebook2.alwaysOn") : undefined}
                />
                {enabled &&
                  !p.always_enabled &&
                  ["sa-sama-advertising", "sa-cma-securities"].includes(p.code) && (
                    <Checkbox
                      label={t("rulebook2.includeDrafts")}
                      hint={t("rulebook2.includeDraftsHint")}
                      checked={drafts}
                      disabled={save.isPending}
                      onChange={(e) =>
                        save.mutate({ pack: p.code, enabled, drafts: e.target.checked })
                      }
                    />
                  )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Packs → rules, with sources and review state (Phase 2 rulebook). */
export function RulePacks({ rules }: { rules: Rule[] }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const isAdmin = useIsAdmin(user?.id).data === true;
  const packs = usePacks();
  const sources = useSources();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: fetchMyOrgs, enabled: Boolean(user) });
  const orgManager = (orgs.data ?? []).some((o) =>
    o.org_members.some((m) => m.user_id === user?.id && (m.role === "owner" || m.role === "admin")),
  );
  if (packs.isPending) return <Skeleton className="h-32 w-full rounded-lg" />;
  if (!packs.data?.length) return null;
  const sourceMap = new Map((sources.data ?? []).map((s) => [s.id, s]));
  return (
    <section aria-labelledby="packs-title" className="flex flex-col gap-4">
      <div>
        <h2 id="packs-title" className="text-xl font-bold">
          {t("rulebook2.packsTitle")}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{t("rulebook2.packsSubtitle")}</p>
      </div>
      {user && <OrgPackSettings packs={packs.data} />}
      {packs.data.map((p) => {
        const inPack = rules.filter((r) => r.pack === p.code);
        if (!inPack.length) return null;
        const drafts = inPack.filter(
          (r) => r.review_state === "draft" || r.review_state === "legal_review",
        ).length;
        return (
          <Card key={p.code} className="flex flex-col gap-2" data-testid={`pack-${p.code}`}>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{lang === "en" ? p.name_en : p.name_ar}</CardTitle>
              <Badge>{p.authority}</Badge>
              <Badge>{t("rulebook2.rulesCount", { n: inPack.length })}</Badge>
              {drafts > 0 && (
                <Badge variant="neutral">{t("rulebook2.draftCount", { n: drafts })}</Badge>
              )}
            </div>
            {p.description_ar && lang === "ar" && (
              <p className="text-sm text-fg-muted">{p.description_ar}</p>
            )}
            <details>
              <summary className="cursor-pointer text-sm text-green">
                {t("rulebook2.ruleDetail")}
              </summary>
              <ul className="mt-2">
                {inPack.map((r) => (
                  <RuleDetail
                    key={r.id}
                    rule={r}
                    source={
                      r.regulatory_source_id ? sourceMap.get(r.regulatory_source_id) : undefined
                    }
                    showInternals={isAdmin || orgManager}
                    canChangeState={isAdmin}
                  />
                ))}
              </ul>
            </details>
          </Card>
        );
      })}
      {orgManager && <OverridesCard rules={rules} />}
    </section>
  );
}
