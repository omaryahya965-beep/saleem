import {
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronUp,
  Crown,
  Eye,
  Gavel,
  Handshake,
  Megaphone,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, Button, Dialog, Spinner } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import {
  ADVANCED_PERSONAS,
  DEMO_EMAILS,
  ESSENTIAL_PERSONAS,
  signInAsPersona,
  type DemoPersona,
} from "@/lib/api/auth";

const ICONS: Record<DemoPersona, ReactNode> = {
  admin: <Building2 className="size-4.5 text-green" />,
  creator: <Megaphone className="size-4.5 text-green" />,
  reviewer: <ScanSearch className="size-4.5 text-green" />,
  external_uploader: <Handshake className="size-4.5 text-green" />,
  owner: <Crown className="size-4.5 text-amber-text" />,
  compliance_lead: <ShieldCheck className="size-4.5 text-green" />,
  legal: <Gavel className="size-4.5 text-green" />,
  external_reviewer: <BadgeCheck className="size-4.5 text-green" />,
  viewer: <Eye className="size-4.5 text-fg-muted" />,
};

interface DemoCardProps {
  persona: DemoPersona;
  busy: DemoPersona | null;
  onEnter: (p: DemoPersona) => void;
  isAdvanced?: boolean;
}

function DemoCard({ persona, busy, onEnter, isAdvanced }: DemoCardProps) {
  const { t } = useI18n();
  return (
    <div
      className={`flex flex-col justify-between gap-2.5 rounded-lg border p-3 shadow-xs transition-colors hover:border-border-strong ${
        isAdvanced ? "border-border/80 bg-sunken/30" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2 font-medium text-fg">
            {ICONS[persona]}
            <span className="font-semibold text-sm">{t(`org.roles.${persona}` as TKey)}</span>
          </div>
          {persona === "admin" && (
            <Badge variant="green" className="text-[10px] px-1.5 py-0">
              موصى به
            </Badge>
          )}
        </div>
        <span
          className="self-start rounded bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-fg-muted"
          dir="ltr"
        >
          {DEMO_EMAILS[persona]}
        </span>
        <p className="text-xs leading-relaxed text-fg-muted">
          {t(`rolesPage.desc.${persona}` as TKey)}
        </p>
      </div>
      <Button
        size="sm"
        onClick={() => void onEnter(persona)}
        disabled={busy !== null}
        data-testid={`demo-enter-${persona}`}
        className="w-full mt-1 font-medium"
      >
        {busy === persona ? <Spinner /> : t("auth.demo.enter")}
      </Button>
    </div>
  );
}

/**
 * «تجربة سَليم حسب الدور»: Organized demo accounts dialog:
 * - Section A: 4 Essential Roles (الأدوار الأساسية) immediately visible.
 * - Section B: 5 Advanced Roles (الأدوار المتقدمة) in a collapsible drawer.
 */
export function DemoRolePicker({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const enter = async (p: DemoPersona) => {
    setBusy(p);
    setError(null);
    try {
      await signInAsPersona(p);
      setOpen(false);
      onSignedIn();
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

  return (
    <section
      aria-labelledby="demo-roles"
      data-testid="demo-roles"
      className="flex flex-col gap-2 border-t border-border pt-4"
    >
      <h2 id="demo-roles" className="text-sm font-bold">
        {t("auth.demo.title")}
      </h2>
      <p className="text-xs text-fg-muted">{t("auth.demo.hint")}</p>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid="demo-open">
        {t("auth.demo.explore")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("auth.demo.title")}
        description={t("auth.demo.dialogHint")}
        className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        {error && (
          <p role="alert" className="mb-3 rounded-md bg-red-bg px-3 py-2 text-sm text-red">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {/* Section A: Essential Roles (الأدوار الأساسية) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-sm text-fg">
                <Sparkles className="size-4 text-green" />
                <span>{t("auth.demo.essentialSection")}</span>
              </div>
              <span className="text-xs text-fg-muted">{t("auth.demo.essentialHint")}</span>
            </div>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {ESSENTIAL_PERSONAS.map((p) => (
                <li key={p}>
                  <DemoCard persona={p} busy={busy} onEnter={enter} />
                </li>
              ))}
            </ul>
          </div>

          {/* Section B: Advanced Roles (الأدوار المتقدمة) - Collapsible */}
          <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-sunken/20 p-2.5">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              data-testid="demo-advanced-toggle"
              className="flex items-center justify-between w-full text-start text-xs font-semibold text-fg hover:text-fg-strong transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-fg-muted" />
                <span>
                  {showAdvanced ? t("auth.demo.hideAdvanced") : t("auth.demo.showAdvanced")}
                </span>
                <span className="text-[11px] text-fg-muted font-normal">
                  — {t("auth.demo.advancedHint")}
                </span>
              </div>
              <div className="flex items-center gap-1 text-fg-muted">
                {showAdvanced ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </div>
            </button>

            {showAdvanced && (
              <ul className="grid gap-2.5 sm:grid-cols-3 pt-2 animate-in fade-in duration-200">
                {ADVANCED_PERSONAS.map((p) => (
                  <li key={p}>
                    <DemoCard persona={p} busy={busy} onEnter={enter} isAdvanced />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-fg-muted leading-relaxed">{t("auth.demo.fictional")}</p>
      </Dialog>
    </section>
  );
}
