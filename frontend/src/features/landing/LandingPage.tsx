import { Link } from "@tanstack/react-router";
import {
  Bot,
  Building2,
  Clapperboard,
  Eye,
  FileSearch,
  Info,
  Megaphone,
  Newspaper,
  ScanSearch,
  ShieldCheck,
  ShoppingBag,
  Upload,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Brand, Button, StatusChip, VideoTimeline } from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { cn } from "@/lib/utils";

const DEMO_ID = "d0000000-0000-0000-0000-000000000001";
const DEMO_DURATION = 42;
const DEMO_ISSUES: {
  id: string;
  t: number;
  severity: "violation" | "warning";
  title: TKey;
  fix: TKey;
  code: string;
}[] = [
  {
    id: "a",
    t: 0,
    severity: "violation",
    title: "landing.demo1Title",
    fix: "landing.demo1Fix",
    code: "MAW-01",
  },
  {
    id: "b",
    t: 12,
    severity: "violation",
    title: "landing.demo2Title",
    fix: "landing.demo2Fix",
    code: "COM-01",
  },
  {
    id: "c",
    t: 24,
    severity: "warning",
    title: "landing.demo3Title",
    fix: "landing.demo3Fix",
    code: "MAW-02",
  },
];

/** Interactive mini-report: timeline markers drive the issue card. No images, no video — fast. */
function MiniReport() {
  const { t, tn } = useI18n();
  const [selected, setSelected] = useState("b");
  const [time, setTime] = useState(12);
  const issue = DEMO_ISSUES.find((i) => i.id === selected) ?? DEMO_ISSUES[1]!;
  const pick = (id: string) => {
    const i = DEMO_ISSUES.find((x) => x.id === id);
    if (!i) return;
    setSelected(id);
    setTime(i.t);
  };
  const onSeek = (s: number) => {
    setTime(s);
    const nearest = DEMO_ISSUES.reduce((a, b) => (Math.abs(b.t - s) < Math.abs(a.t - s) ? b : a));
    if (Math.abs(nearest.t - s) <= 3) setSelected(nearest.id);
  };
  return (
    <div className="rounded-lg bg-ink p-4 text-paper shadow-overlay sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-paper/80">{t("landing.demoTitle")}</span>
        <StatusChip tone="violation" size="sm">
          {t("status.needs_fixes")}
        </StatusChip>
      </div>
      <p className="mt-3 text-sm text-paper/85">
        {tn("count.violations", 2)} · {tn("count.warnings", 1)}
      </p>
      <div className="mt-3 rounded-md bg-card p-3 text-fg">
        <VideoTimeline
          duration={DEMO_DURATION}
          currentTime={time}
          markers={DEMO_ISSUES.map((i) => ({
            id: i.id,
            t: i.t,
            severity: i.severity,
            title: t(i.title),
          }))}
          selectedId={selected}
          onSeek={onSeek}
          onSelectMarker={pick}
        />
        <p className="mt-1 text-center text-xs text-fg-muted">{t("landing.demoHint")}</p>
      </div>
      <div aria-live="polite" className="mt-3 rounded-md bg-ink-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={issue.severity} size="sm">
            {t(`severity.${issue.severity}`)}
          </StatusChip>
          <span className="tabular text-sm font-bold">{formatClock(issue.t)}</span>
          <span dir="ltr" className="font-mono text-xs text-mint">
            {issue.code}
          </span>
        </div>
        <p className="mt-2 text-lg font-bold">{t(issue.title)}</p>
        <p className="mt-2 flex items-start gap-2 text-sm text-paper/85">
          <Wrench aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mint" />
          {t(issue.fix)}
        </p>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="grid size-11 place-items-center rounded-md bg-green-bg text-green">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-1 text-lg font-bold">{title}</h3>
      <p className="text-fg-muted">{body}</p>
    </div>
  );
}

export function LandingPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const display = lang === "ar" ? "font-display" : "tracking-tight";
  const section = "mx-auto w-full max-w-[1200px] px-4 sm:px-8";

  return (
    <div className="flex flex-col">
      <section
        className={cn(
          section,
          "grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16 lg:py-24",
        )}
      >
        <div className="flex flex-col gap-6">
          <span className="text-sm font-medium text-green">{t("brand.tagline")}</span>
          <h1 className={cn("text-4xl font-bold sm:text-5xl", display)}>{t("brand.promise")}</h1>
          <p className="prose-measure text-lg text-fg-muted">{t("landing.heroBody")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link to={user ? "/new" : "/signup"}>
                <Upload aria-hidden="true" />
                {t("landing.ctaStart")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/checks/$id" params={{ id: DEMO_ID }}>
                <Eye aria-hidden="true" />
                {t("landing.ctaExample")}
              </Link>
            </Button>
          </div>
        </div>
        <MiniReport />
      </section>

      <section aria-labelledby="how" className="border-y border-border bg-card">
        <div className={cn(section, "py-12 sm:py-16")}>
          <h2 id="how" className={cn("text-2xl font-bold sm:text-3xl", display)}>
            {t("landing.howTitle")}
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {(
              [
                ["landing.how1Title", "landing.how1Body", Upload],
                ["landing.how2Title", "landing.how2Body", ScanSearch],
                ["landing.how3Title", "landing.how3Body", ShieldCheck],
              ] as const
            ).map(([title, body, Icon], i) => (
              <li key={title} className="flex flex-col gap-2">
                <span className="flex items-center gap-3">
                  <span className="tabular grid size-9 place-items-center rounded-full bg-green text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon aria-hidden="true" className="size-5 text-green" />
                </span>
                <h3 className="mt-2 text-lg font-bold">{t(title)}</h3>
                <p className="text-fg-muted">{t(body)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="who" className={cn(section, "py-12 sm:py-16")}>
        <h2 id="who" className={cn("text-2xl font-bold sm:text-3xl", display)}>
          {t("landing.whoTitle")}
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Feature
            icon={UserRound}
            title={t("landing.whoCreators")}
            body={t("landing.whoCreatorsBody")}
          />
          <Feature
            icon={Building2}
            title={t("landing.whoAgencies")}
            body={t("landing.whoAgenciesBody")}
          />
          <Feature
            icon={ShoppingBag}
            title={t("landing.whoBrands")}
            body={t("landing.whoBrandsBody")}
          />
          <Feature
            icon={Newspaper}
            title={t("landing.whoMedia")}
            body={t("landing.whoMediaBody")}
          />
        </div>
      </section>

      <section aria-labelledby="checks" className="bg-ink text-paper">
        <div className={cn(section, "py-12 sm:py-16")}>
          <h2 id="checks" className={cn("text-2xl font-bold text-paper sm:text-3xl", display)}>
            {t("landing.checksTitle")}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["ruleCategories.mawthooq", "landing.checksMawthooq", Megaphone],
                ["ruleCategories.content", "landing.checksContent", Clapperboard],
                ["ruleCategories.ai", "landing.checksAi", Bot],
                ["ruleCategories.commerce", "landing.checksCommerce", FileSearch],
              ] as const
            ).map(([title, body, Icon]) => (
              <li key={title} className="flex gap-4 rounded-md border border-paper/12 bg-ink-2 p-5">
                <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-mint" />
                <div>
                  <h3 className="font-bold text-paper">{t(title)}</h3>
                  <p className="mt-1 text-sm text-paper/80">{t(body)}</p>
                </div>
              </li>
            ))}
          </ul>
          <Link
            to="/rules"
            className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-mint underline-offset-4 hover:underline"
          >
            {t("nav.rulebook")}
          </Link>
        </div>
      </section>

      <section aria-labelledby="trust" className={cn(section, "py-12 sm:py-16")}>
        <h2 id="trust" className={cn("text-2xl font-bold sm:text-3xl", display)}>
          {t("landing.trustTitle")}
        </h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          {(
            [
              ["landing.trustAdvisory", "landing.trustAdvisoryBody"],
              ["landing.trustPrivacy", "landing.trustPrivacyBody"],
              ["landing.trustSources", "landing.trustSourcesBody"],
              ["landing.trustLimits", "landing.trustLimitsBody"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="border-s-2 border-green ps-4">
              <dt className="font-bold">{t(k)}</dt>
              <dd className="m-0 mt-1 text-fg-muted">{t(v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <footer className="border-t border-border bg-card">
        <div
          className={cn(
            section,
            "flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <Brand />
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t("brand.disclaimer")}
          </p>
          <p className="text-xs text-fg-muted">{t("landing.footerRights")}</p>
        </div>
      </footer>
    </div>
  );
}
