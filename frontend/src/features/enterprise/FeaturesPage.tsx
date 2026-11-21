// /features — «الميزات» (V2 completion §6, D194). Features grouped by function, each with description,
// availability, state, requirements, permissions, dependencies and its own configuration in place (risk acceptors
// inside Risk Acceptance, presets inside Multi-stage approval, rules inside Self-approval, keys and endpoints inside
// Integrations, quota inside SALEEM Fix). Flags are enforced by the server (org_feature checks in every RPC).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Settings2 } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Page,
  PageHeader,
  Switch,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { can } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";
import { flagOn, setFeatures, type FeatureFlag } from "@/lib/api/flows";
import { pk, useOrgSettings } from "@/lib/api/promotions";
import { OrgSelect } from "@/features/libraries/OrgSelect";
import { useOrgPicker } from "@/features/libraries/orgPicker";
import { PresetsCard } from "./PresetsCard";
import { RiskAcceptorsCard } from "./RiskPanel";
import { SelfApprovalRulesCard } from "./SelfApproval";
import { IntegrationsCard } from "./IntegrationsCard";
import { cn } from "@/lib/utils";

type Availability = "available" | "needs_setup" | "provider";
const CATEGORIES: { key: string; flags: { f: FeatureFlag; availability: Availability }[] }[] = [
  {
    key: "governance",
    flags: [
      { f: "multi_level_approval", availability: "available" },
      { f: "risk_acceptance", availability: "needs_setup" },
      { f: "self_approval", availability: "needs_setup" },
    ],
  },
  {
    key: "management",
    flags: [
      { f: "partners", availability: "available" },
      { f: "upload_types", availability: "available" },
      { f: "lifecycle", availability: "available" },
    ],
  },
  {
    key: "compliance",
    flags: [
      { f: "internal_rules", availability: "available" },
      { f: "readability_hint", availability: "available" },
    ],
  },
  {
    key: "intelligence",
    flags: [
      { f: "analytics", availability: "available" },
      { f: "ask_saleem", availability: "provider" },
      { f: "saleem_fix", availability: "provider" },
    ],
  },
  {
    key: "integrations",
    flags: [
      { f: "api", availability: "available" },
      { f: "notifications_chat", availability: "needs_setup" },
    ],
  },
];

export function FeaturesPage() {
  const { t } = useI18n();
  const picker = useOrgPicker();
  const manager = can(picker.role, "manage_settings");
  const orgId = picker.orgId;
  return (
    <Page wide className="flex flex-col gap-6">
      <PageHeader title={t("flags.pageTitle")} description={t("feat2.subtitle")} />
      <OrgSelect picker={picker} />
      {manager && orgId ? (
        <Catalogue orgId={orgId} />
      ) : (
        <EmptyState icon={<Settings2 />} title={t("flags.managersOnly")} />
      )}
    </Page>
  );
}

function Catalogue({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const features = (settings.data?.features ?? {}) as Record<string, unknown>;
  const save = useMutation({
    mutationFn: (v: { f: FeatureFlag; on: boolean }) => {
      const next: Record<string, boolean> = {};
      for (const [k, val] of Object.entries(features)) if (typeof val === "boolean") next[k] = val;
      next[v.f] = v.on;
      return setFeatures(orgId, next);
    },
    onSuccess: () => {
      toast.success(t("flags.saved"));
      void qc.invalidateQueries({ queryKey: pk.orgSettings(orgId) });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  if (!settings.data) return null;
  return (
    <div className="flex flex-col gap-6" data-testid="feature-flags">
      {CATEGORIES.map((c) => (
        <section key={c.key} aria-labelledby={`cat-${c.key}`} className="flex flex-col gap-3">
          <h2 id={`cat-${c.key}`} className="text-lg font-bold">
            {t(`feat2.cat.${c.key}` as TKey)}
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {c.flags.map(({ f, availability }) => (
              <FeatureCard
                key={f}
                f={f}
                availability={availability}
                on={flagOn(settings.data!.features, f)}
                busy={save.isPending}
                onToggle={(on) => save.mutate({ f, on })}
                orgId={orgId}
                features={features}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function FeatureCard({
  f,
  availability,
  on,
  busy,
  onToggle,
  orgId,
  features,
}: {
  f: FeatureFlag;
  availability: Availability;
  on: boolean;
  busy: boolean;
  onToggle: (on: boolean) => void;
  orgId: string;
  features: Record<string, unknown>;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const config = configFor(f, orgId, features);
  return (
    <Card
      className={cn("flex flex-col gap-3", on && "border-green/40")}
      data-testid={`feature-${f}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{t(`flags.${f}` as TKey)}</h3>
          <p className="mt-1 text-sm text-fg-muted">{t(`flags.${f}Hint` as TKey)}</p>
        </div>
        <Switch
          checked={on}
          disabled={busy}
          onCheckedChange={onToggle}
          label={on ? t("feat2.on") : t("feat2.off")}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={availability === "available" ? "outline" : "neutral"}>
          {t(`feat2.availability.${availability}` as TKey)}
        </Badge>
        <Badge variant="neutral">{on ? t("feat2.enabled") : t("feat2.disabled")}</Badge>
      </div>
      <dl className="grid gap-1 text-sm">
        <div>
          <dt className="inline font-medium">{t("feat2.requires")}: </dt>
          <dd className="inline text-fg-muted">{t(`feat2.f.${f}.req` as TKey)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">{t("feat2.who")}: </dt>
          <dd className="inline text-fg-muted">{t(`feat2.f.${f}.perm` as TKey)}</dd>
        </div>
        <div>
          <dt className="inline font-medium">{t("feat2.depends")}: </dt>
          <dd className="inline text-fg-muted">{t(`feat2.f.${f}.deps` as TKey)}</dd>
        </div>
      </dl>
      {config && (
        <div>
          <Button
            size="sm"
            variant="secondary"
            icon={<ChevronDown className={cn("transition-transform", open && "rotate-180")} />}
            aria-expanded={open}
            onClick={() => setOpen((x) => !x)}
          >
            {t("feat2.configure")}
          </Button>
          {open && <div className="mt-3">{config}</div>}
        </div>
      )}
    </Card>
  );
}

function configFor(
  f: FeatureFlag,
  orgId: string,
  features: Record<string, unknown>,
): React.ReactNode {
  switch (f) {
    case "multi_level_approval":
      return <PresetsCard orgId={orgId} />;
    case "risk_acceptance":
      return <RiskAcceptorsCard orgId={orgId} />;
    case "self_approval":
      return <SelfApprovalRulesCard orgId={orgId} />;
    case "api":
    case "notifications_chat":
      return <IntegrationsCard orgId={orgId} />;
    case "saleem_fix":
      return (
        <FixQuota orgId={orgId} current={Number(features["saleem_fix_monthly_limit"] ?? 30)} />
      );
    case "partners":
      return <LinkTo to={`/org/${orgId}`} label="feat2.openPartners" />;
    case "internal_rules":
      return <LinkTo to="/company-rules" label="feat2.openCompanyRules" />;
    default:
      return null;
  }
}

function LinkTo({ to, label }: { to: string; label: string }) {
  const { t } = useI18n();
  return (
    <Button asChild size="sm" variant="ghost">
      <Link to={to}>{t(label as TKey)}</Link>
    </Button>
  );
}

function FixQuota({ orgId, current }: { orgId: string; current: number }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [n, setN] = useState(String(current));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (
        supabase.rpc as unknown as (
          f: string,
          a: object,
        ) => PromiseLike<{ error: { message: string } | null }>
      )("set_fix_monthly_limit", { _org: orgId, _limit: Number(n) });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success(t("flags.saved"));
      void qc.invalidateQueries({ queryKey: pk.orgSettings(orgId) });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">{t("feat2.fixLimit")}</span>
        <Input
          type="number"
          min={0}
          max={1000}
          value={n}
          onChange={(e) => setN(e.target.value)}
          className="w-40"
        />
      </label>
      <p className="text-xs text-fg-muted">{t("feat2.fixLimitHint")}</p>
      <Button
        size="sm"
        className="self-start"
        loading={save.isPending}
        disabled={!/^\d+$/.test(n) || Number(n) > 1000}
        onClick={() => save.mutate()}
      >
        {t("common.save")}
      </Button>
    </div>
  );
}
