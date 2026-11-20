// Public landing page (V2 upgrade §31, D183): SALEEM as an advertisement-to-approval workspace. Every capability
// listed is implemented; provider-dependent or experimental ones are labelled. No endorsement or compliance
// guarantee is claimed. The product preview is real markup of the review workspace (fictional Nada Cream data).
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileClock,
  FileSearch,
  GitCompare,
  Handshake,
  History,
  Languages,
  Layers,
  ListChecks,
  Megaphone,
  Mic,
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Timer,
  Upload,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, StatusChip } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

/** Older public demo (herbal tea) — still reachable at /checks/<id> for existing links. */
export const DEMO_ID = "d0000000-0000-0000-0000-000000000003";

const JOURNEY: { key: string; icon: LucideIcon }[] = [
  { key: "create", icon: Megaphone },
  { key: "upload", icon: Upload },
  { key: "analyse", icon: ScanSearch },
  { key: "review", icon: FileSearch },
  { key: "correct", icon: Wrench },
  { key: "revise", icon: Layers },
  { key: "submit", icon: ClipboardCheck },
  { key: "decide", icon: BadgeCheck },
  { key: "keep", icon: History },
];

const CAPABILITIES: { key: string; icon: LucideIcon; tag?: "provider" | "experimental" }[] = [
  { key: "analysis", icon: ScanSearch, tag: "provider" },
  { key: "transcription", icon: Mic, tag: "provider" },
  { key: "evidence", icon: Timer },
  { key: "applicability", icon: Scale },
  { key: "workflow", icon: ClipboardCheck },
  { key: "compare", icon: GitCompare },
  { key: "roles", icon: Users },
  { key: "policies", icon: ListChecks },
  { key: "partners", icon: Handshake },
  { key: "campaigns", icon: Building2 },
  { key: "history", icon: FileClock },
  { key: "analytics", icon: BarChart3 },
  { key: "fix", icon: Sparkles, tag: "experimental" },
];

const ROLES = ["marketing", "compliance", "legal", "managers", "partners"] as const;
const TRUST = ["human", "evidence", "versioned", "access", "history", "limits"] as const;

export function LandingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const startTo = user ? "/new" : "/signup";
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid w-full max-w-[1400px] gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:py-20">
          <div className="flex flex-col gap-5">
            <Badge variant="outline" className="self-start">
              {t("land2.eyebrow")}
            </Badge>
            <h1 className="text-4xl leading-tight font-bold text-balance sm:text-5xl">
              {t("land2.heroTitle")}
            </h1>
            <p className="max-w-xl text-lg text-fg-muted">{t("land2.heroBody")}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={startTo}>{t("land2.ctaStart")}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/sample">{t("land2.ctaSample")}</Link>
              </Button>
              {!user && (
                <Button asChild size="lg" variant="ghost">
                  <Link to="/login">{t("land2.ctaDemo")}</Link>
                </Button>
              )}
            </div>
            <p className="text-sm text-fg-muted">{t("land2.heroNote")}</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Journey */}
      <section id="how" className="mx-auto w-full max-w-[1400px] scroll-mt-24 px-4 py-14 sm:px-8">
        <h2 className="text-3xl font-bold">{t("land2.howTitle")}</h2>
        <p className="mt-2 max-w-2xl text-fg-muted">{t("land2.howBody")}</p>
        <ol className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-9">
          {JOURNEY.map((s, i) => (
            <li
              key={s.key}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
            >
              <span className="flex items-center justify-between text-fg-muted">
                <s.icon aria-hidden="true" className="size-5 text-green" />
                <span className="tabular text-xs">{i + 1}</span>
              </span>
              <span className="font-bold">{t(`land2.step.${s.key}` as TKey)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Capabilities */}
      <section id="capabilities" className="scroll-mt-24 border-y border-border bg-surface">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-8">
          <h2 className="text-3xl font-bold">{t("land2.capTitle")}</h2>
          <p className="mt-2 max-w-2xl text-fg-muted">{t("land2.capBody")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CAPABILITIES.map((c) => (
              <li key={c.key} className="flex flex-col gap-2 rounded-lg border border-border p-5">
                <span className="flex items-center justify-between gap-2">
                  <c.icon aria-hidden="true" className="size-6 text-green" />
                  {c.tag && <Badge variant="neutral">{t(`land2.tag.${c.tag}` as TKey)}</Badge>}
                </span>
                <h3 className="font-bold">{t(`land2.cap.${c.key}.title` as TKey)}</h3>
                <p className="text-sm text-fg-muted">{t(`land2.cap.${c.key}.body` as TKey)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-8">
        <h2 className="text-3xl font-bold">{t("land2.rolesTitle")}</h2>
        <div className="mt-8 grid gap-3 md:grid-cols-5">
          {ROLES.map((r, i) => (
            <div key={r} className="relative flex flex-col gap-2 rounded-lg bg-ink p-5 text-paper">
              <span className="tabular text-xs text-mint">{i + 1}</span>
              <h3 className="text-lg font-bold text-paper">{t(`land2.role.${r}.title` as TKey)}</h3>
              <p className="text-sm text-paper/85">{t(`land2.role.${r}.body` as TKey)}</p>
              {i < ROLES.length - 1 && (
                <ArrowLeft
                  aria-hidden="true"
                  className="absolute top-1/2 -end-3 hidden size-5 text-fg-muted md:block ltr:rotate-180"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-[1400px] gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <div>
            <ShieldCheck aria-hidden="true" className="size-8 text-green" />
            <h2 className="mt-3 text-3xl font-bold">{t("land2.trustTitle")}</h2>
            <p className="mt-2 text-fg-muted">{t("land2.trustBody")}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TRUST.map((k) => (
              <li key={k} className="rounded-lg border border-border p-4">
                <h3 className="font-bold">{t(`land2.trust.${k}.title` as TKey)}</h3>
                <p className="mt-1 text-sm text-fg-muted">{t(`land2.trust.${k}.body` as TKey)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto flex w-full max-w-[1400px] flex-col items-start gap-4 px-4 py-14 sm:px-8">
        <h2 className="text-3xl font-bold">{t("land2.finalTitle")}</h2>
        <p className="max-w-2xl text-fg-muted">{t("land2.finalBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={startTo}>{t("sample.cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/rules">{t("land2.ctaRules")}</Link>
          </Button>
        </div>
        <p className="text-xs text-fg-muted">
          <Languages aria-hidden="true" className="me-1 inline size-3.5" />
          {t("land2.footnote")}
        </p>
      </section>
    </div>
  );
}

/** Real markup of the review workspace (not a screenshot), with the fictional Nada Cream example. */
function ProductPreview() {
  const { t } = useI18n();
  return (
    <div
      className="rounded-xl border border-border bg-paper p-3 shadow-overlay sm:p-4"
      aria-label={t("land2.previewLabel")}
      role="img"
    >
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-bold">{t("sample.title")}</p>
          <div className="flex gap-1.5">
            <StatusChip tone="ready" size="sm">
              {t("ws.analysis.done")}
            </StatusChip>
            <StatusChip tone="violation" size="sm">
              {t("promo.reviewStatus.changes_requested")}
            </StatusChip>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { v: "3", l: t("ws.summary.violations"), c: "text-red" },
            { v: "3", l: t("ws.summary.warnings"), c: "text-amber-text" },
            { v: "9", l: t("land2.previewEvidence"), c: "" },
            { v: "1/6", l: t("land2.previewReviewed"), c: "" },
          ].map((x) => (
            <div key={x.l} className="rounded-md bg-sunken p-2">
              <p className={cn("tabular text-xl font-bold", x.c)}>{x.v}</p>
              <p className="text-[11px] text-fg-muted">{x.l}</p>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-ink/15 bg-sunken p-3 text-sm">
          <p className="text-xs font-bold text-fg-muted">{t("ws.next.title")}</p>
          <p className="font-bold">{t("ws.next.marketer.fix_changes")}</p>
        </div>
        {[
          {
            s: "violation" as const,
            title: "ادعاء مطلق بنتيجة مضمونة في محتوى ترويجي.",
            n: 4,
            ts: ["0:00", "0:11", "0:15"],
          },
          {
            s: "warning" as const,
            title: "لم يُدخل رقم رخصة موثوق لحساب ينشر محتوى ترويجياً.",
            n: 1,
            ts: [],
          },
        ].map((f) => (
          <div key={f.title} className="relative rounded-md border border-border p-3 ps-4 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-3 start-0 w-1 rounded-e-full",
                f.s === "violation" ? "bg-red" : "bg-amber",
              )}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusChip tone={f.s} size="sm">
                {t(`severity.${f.s}`)}
              </StatusChip>
              {f.n > 1 && (
                <Badge variant="outline">{t("ws.findings.occurrences", { n: f.n })}</Badge>
              )}
              {f.ts.map((x) => (
                <span
                  key={x}
                  className="tabular rounded-full border border-border px-2 text-xs font-bold"
                >
                  {x}
                </span>
              ))}
            </div>
            <p className="mt-1 font-medium" dir="rtl">
              {f.title}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
