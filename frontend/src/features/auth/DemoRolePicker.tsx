import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Crown,
  Download,
  Eye,
  FileSearch,
  Gavel,
  Handshake,
  Megaphone,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wand2,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  ADVANCED_PERSONAS,
  ESSENTIAL_PERSONAS,
  INDIVIDUAL_DEMO,
  signInAsPersona,
  type DemoPersona,
} from "@/lib/api/auth";
import { PERSONAL, setActiveOrg } from "@/features/libraries/orgPicker";
import { cn } from "@/lib/utils";

const ICONS: Record<DemoPersona, ReactNode> = {
  admin: <Building2 />,
  creator: <Megaphone />,
  reviewer: <ScanSearch />,
  external_uploader: <Handshake />,
  owner: <Crown />,
  compliance_lead: <ShieldCheck />,
  legal: <Gavel />,
  external_reviewer: <BadgeCheck />,
  viewer: <Eye />,
};

type Audience = "organization" | "individual";
type Busy = DemoPersona | typeof INDIVIDUAL_DEMO | null;

/**
 * D211 «جرّب سَليم»: two demo experiences. Companies and organisations open one of the nine sandbox roles (four
 * prominent, five more on request); individuals and content creators open a personal workspace that belongs to no
 * organisation. Sessions come from the demo-login broker: no password ever reaches the browser.
 */
export function DemoRolePicker({ onSignedIn }: { onSignedIn: (to?: string) => void }) {
  const { t } = useI18n();
  const [audience, setAudience] = useState<Audience | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const enter = async (p: Exclude<Busy, null>) => {
    setBusy(p);
    setError(null);
    try {
      await signInAsPersona(p);
      // The individual demo opens its personal workspace; an organisation role opens the sandbox organisation.
      setActiveOrg(p === INDIVIDUAL_DEMO ? PERSONAL : "");
      onSignedIn("/dashboard");
    } catch (e) {
      const code = (e as Error).message;
      setError(
        t(
          (["rate_limited", "demo_disabled", "demo_not_seeded"].includes(code)
            ? `auth.demo.error.${code}`
            : "auth.demo.error.generic") as TKey,
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const roleButton = (p: DemoPersona, compact = false) => (
    <li key={p}>
      <button
        type="button"
        onClick={() => void enter(p)}
        disabled={busy !== null}
        data-testid={`demo-enter-${p}`}
        className={cn(
          "group flex h-full w-full items-start gap-3 rounded-[14px] border border-white/15 bg-white/[0.06] p-3.5 text-start text-white transition-colors hover:border-gold/60 hover:bg-white/[0.11] focus-visible:outline-2 focus-visible:outline-gold disabled:opacity-60",
          compact && "p-3",
        )}
      >
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-gold [&_svg]:size-4.5">
          {busy === p ? <Spinner className="size-4" /> : ICONS[p]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{t(`org.roles.${p}` as TKey)}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-white/70">
            {t(`rolesPage.desc.${p}` as TKey)}
          </span>
        </span>
        <ArrowLeft
          aria-hidden="true"
          className="mt-2 size-4 shrink-0 text-white/50 group-hover:text-gold ltr:rotate-180"
        />
      </button>
    </li>
  );

  return (
    <section aria-labelledby="demo-roles" data-testid="demo-roles" className="flex flex-col gap-4">
      <div>
        <h2 id="demo-roles" className="text-lg font-bold text-fg">
          {t("auth.demo.title")}
        </h2>
        <p className="mt-0.5 text-sm text-fg-muted">{t("auth.demo.audienceHint")}</p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red/25 bg-red-bg px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      <div
        className="grid gap-3 sm:grid-cols-2"
        role="group"
        aria-label={t("auth.demo.audienceHint")}
      >
        <button
          type="button"
          data-testid="demo-open"
          aria-pressed={audience === "organization"}
          onClick={() => setAudience("organization")}
          className={cn(
            "flex flex-col gap-2 rounded-[18px] border-2 p-4 text-start transition-colors focus-visible:outline-2 focus-visible:outline-green",
            audience === "organization"
              ? "border-forest bg-forest text-white"
              : "border-border bg-card hover:border-forest/50",
          )}
        >
          <span className="flex items-center justify-between">
            <span
              className={cn(
                "grid size-10 place-items-center rounded-full [&_svg]:size-5",
                audience === "organization" ? "bg-white/10 text-gold" : "bg-green-bg text-green",
              )}
            >
              <Building2 aria-hidden="true" />
            </span>
            {audience === "organization" && (
              <Check aria-hidden="true" className="size-5 text-gold" />
            )}
          </span>
          <span className="text-base font-bold">{t("auth.demo.orgTitle")}</span>
          <span
            className={cn(
              "text-sm leading-relaxed",
              audience === "organization" ? "text-white/75" : "text-fg-muted",
            )}
          >
            {t("auth.demo.orgBody")}
          </span>
        </button>
        <button
          type="button"
          data-testid="demo-audience-individual"
          aria-pressed={audience === "individual"}
          onClick={() => setAudience("individual")}
          className={cn(
            "flex flex-col gap-2 rounded-[18px] border-2 p-4 text-start transition-colors focus-visible:outline-2 focus-visible:outline-green",
            audience === "individual"
              ? "border-gold-deep bg-cream text-ink"
              : "border-border bg-card hover:border-gold-deep/60",
          )}
        >
          <span className="flex items-center justify-between">
            <span className="grid size-10 place-items-center rounded-full bg-amber-bg text-amber-text [&_svg]:size-5">
              <UserRound aria-hidden="true" />
            </span>
            {audience === "individual" && (
              <Check aria-hidden="true" className="size-5 text-gold-deep" />
            )}
          </span>
          <span className="text-base font-bold">{t("auth.demo.individualTitle")}</span>
          <span className="text-sm leading-relaxed text-fg-muted">
            {t("auth.demo.individualBody")}
          </span>
        </button>
      </div>

      {audience === "organization" && (
        <div
          className="flex flex-col gap-3 rounded-[20px] bg-forest p-4 sm:p-5"
          data-testid="demo-org-panel"
        >
          <p className="text-sm font-medium text-white/80">{t("auth.demo.essentialSection")}</p>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {ESSENTIAL_PERSONAS.map((p) => roleButton(p))}
          </ul>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            data-testid="demo-advanced-toggle"
            className="flex items-center justify-between rounded-[12px] px-1 py-1.5 text-start text-sm font-medium text-white/85 hover:text-white"
          >
            <span>
              {showAdvanced ? t("auth.demo.hideAdvanced") : t("auth.demo.showAdvanced")}
              <span className="ms-1.5 text-xs font-normal text-white/60">
                — {t("auth.demo.advancedHint")}
              </span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 transition-transform", showAdvanced && "rotate-180")}
            />
          </button>
          {showAdvanced && (
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {ADVANCED_PERSONAS.map((p) => roleButton(p, true))}
            </ul>
          )}
          <p className="text-xs leading-relaxed text-white/60">{t("auth.demo.fictional")}</p>
        </div>
      )}

      {audience === "individual" && (
        <div
          className="flex flex-col gap-4 rounded-[20px] border border-gold/40 bg-cream p-4 sm:p-5"
          data-testid="demo-individual-panel"
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {(
              [
                [<Wand2 key="c" />, "auth.demo.individualCreate"],
                [<FileSearch key="k" />, "auth.demo.individualCheck"],
                [<Sparkles key="f" />, "auth.demo.individualFix"],
                [<Download key="d" />, "auth.demo.individualDownload"],
              ] as const
            ).map(([icon, key]) => (
              <li key={key} className="flex items-start gap-2.5 text-sm text-ink">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white text-gold-deep [&_svg]:size-4">
                  {icon}
                </span>
                {t(key as TKey)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void enter(INDIVIDUAL_DEMO)}
            disabled={busy !== null}
            data-testid="demo-enter-individual"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-bold text-paper hover:bg-ink-2 disabled:opacity-60"
          >
            {busy === INDIVIDUAL_DEMO ? (
              <Spinner className="size-4" />
            ) : (
              <UserRound aria-hidden="true" className="size-4" />
            )}
            {t("auth.demo.individualEnter")}
          </button>
          <p className="text-xs leading-relaxed text-fg-muted">{t("auth.demo.individualNote")}</p>
        </div>
      )}
    </section>
  );
}
