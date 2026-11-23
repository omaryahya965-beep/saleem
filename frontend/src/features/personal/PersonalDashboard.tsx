import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  CircleCheck,
  Eye,
  FilePenLine,
  FileText,
  Film,
  GitCompareArrows,
  Image as ImageIcon,
  Info,
  Lightbulb,
  MessageCircleQuestion,
  Mic,
  Play,
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, ErrorState, Page, ProgressBar, Skeleton, StatusChip } from "@/components/ui";
import { LOGO_COLORS, MARK_PATH, MARK_VIEWBOX } from "@/components/ui/brandPaths";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { listPromotions, type PromotionListItem } from "@/lib/api/promotions";
import { listDrafts } from "@/lib/api/studio";
import {
  fetchPersonalAllowances,
  fetchVersionCards,
  listPersonalCorrections,
  listSavedVideos,
  type PersonalWorkspace,
  type VersionCard,
} from "@/lib/api/personal";
import { cn } from "@/lib/utils";

/** The personal result of an advertisement: the automated result of its current version (never an approval). */
export function personalResult(p: Pick<PromotionListItem, "current">): {
  key: "none" | "unchecked" | "running" | "failed" | "ready" | "needs_fixes" | "review";
  tone: "neutral" | "processing" | "violation" | "ready" | "warning";
} {
  const v = p.current;
  if (!v) return { key: "none", tone: "neutral" };
  if (v.status === "failed") return { key: "failed", tone: "violation" };
  // D219: a version that was uploaded but never sent for analysis is «not checked», not «being checked».
  if (v.status === "queued") return { key: "unchecked", tone: "neutral" };
  if (v.status !== "done") return { key: "running", tone: "processing" };
  if (v.overall_status === "ready") return { key: "ready", tone: "ready" };
  if (v.overall_status === "needs_fixes") return { key: "needs_fixes", tone: "violation" };
  return { key: "review", tone: "warning" };
}

const clock = (s: number) => {
  const n = Math.round(s);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};

const rowLink =
  "flex items-center gap-2.5 rounded-[12px] px-2 py-2 text-sm hover:bg-sunken focus-visible:outline-2 focus-visible:outline-green";

/**
 * «مساحتي الشخصية» (D211, redesigned D219): the individual's home. Checking an advertisement against the applicable
 * Saudi rules is the primary action (hero + dominant card); smart correction, Ask SALEEM and the AI Studio are
 * supporting actions, in that order. Below: the user's own recent results (real previews and finding counts of the
 * latest run), the next step, a compact usage summary, corrections, drafts and saved videos — all read from the
 * server (RLS: own rows only). No organisation, review queue, approval or invented metric anywhere.
 */
export function PersonalDashboard({ workspace }: { workspace: PersonalWorkspace }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const promos = useQuery({
    queryKey: ["personal", "promotions"],
    queryFn: () => listPromotions({ personal: true }),
  });
  const drafts = useQuery({ queryKey: ["personal", "studio-drafts"], queryFn: listDrafts });
  const corrections = useQuery({
    queryKey: ["personal", "corrections"],
    queryFn: listPersonalCorrections,
  });
  const videos = useQuery({
    queryKey: ["personal", "videos", user?.id],
    queryFn: () => listSavedVideos(user!.id),
    enabled: Boolean(user),
  });
  const allowances = useQuery({
    queryKey: ["personal", "allowances"],
    queryFn: fetchPersonalAllowances,
  });

  const list = promos.data ?? [];
  const recent = list.slice(0, 5);
  const recentIds = recent.map((p) => p.current?.id).filter((x): x is string => Boolean(x));
  const cards = useQuery({
    queryKey: ["personal", "version-cards", recentIds],
    queryFn: () => fetchVersionCards(recentIds),
    enabled: recentIds.length > 0,
  });
  const analysed = list.filter((p) => p.current?.status === "done");
  const toFix = analysed.filter((p) => p.current?.overall_status === "needs_fixes");
  const running = list.find((p) => personalResult(p).key === "running");
  const unanalysed = list.filter((p) => !p.current || p.current.status === "queued");
  const studioDrafts = (drafts.data ?? []).filter((d) => d.org_id === null);
  const titleOf = (id: string) => list.find((p) => p.id === id)?.title ?? "—";
  const name =
    workspace.display_name ?? (user?.user_metadata?.["display_name"] as string | undefined);
  const date = (s: string) =>
    new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const display = lang === "ar" ? "font-display" : "tracking-tight";
  const fixTarget = toFix[0] ?? analysed.find((p) => p.current?.overall_status !== "ready");
  const count = (k: "ready" | "review") =>
    analysed.filter((p) => p.current?.overall_status === k).length;

  // The one next step that matters most now (from real state only).
  const next = ((): { body: string; cta: string; to: string } | null => {
    if (promos.isPending || promos.isError) return null;
    if (list.length === 0)
      return {
        body: t("personal.home.next.first"),
        cta: t("personal.home.next.firstCta"),
        to: "/new",
      };
    if (toFix[0])
      return {
        body: t("personal.home.next.fix", { title: toFix[0].title }),
        cta: t("personal.home.next.fixCta"),
        to: `/promotions/${toFix[0].id}/fix`,
      };
    if (running)
      return {
        body: t("personal.home.next.running", { title: running.title }),
        cta: t("personal.home.next.runningCta"),
        to: `/promotions/${running.id}`,
      };
    if (unanalysed[0])
      return {
        body: t("personal.home.next.unchecked", { title: unanalysed[0].title }),
        cta: t("personal.home.next.uncheckedCta"),
        to: `/promotions/${unanalysed[0].id}`,
      };
    return {
      body: t("personal.home.next.clear"),
      cta: t("personal.home.next.clearCta"),
      to: "/new",
    };
  })();

  const usage: [string, number, ReactNode, string][] = [
    ["checked", analysed.length, <ScanSearch key="i" />, "text-ink"],
    ["ready", count("ready"), <CircleCheck key="i" />, "text-green"],
    ["fix", toFix.length, <TriangleAlert key="i" />, "text-red"],
    ["review", count("review"), <Eye key="i" />, "text-amber-text"],
  ];
  const hasLists =
    (corrections.data ?? []).length > 0 ||
    studioDrafts.length + unanalysed.length > 0 ||
    (videos.data ?? []).length > 0;

  return (
    <Page className="flex flex-col gap-6 sm:gap-8">
      {/* Primary: check an advertisement against the rules */}
      <section
        data-testid="personal-dashboard"
        aria-labelledby="personal-hero-title"
        className="relative overflow-hidden rounded-[28px] border border-green/10 bg-[linear-gradient(135deg,var(--color-cream)_30%,var(--color-green-bg))] px-5 py-7 sm:px-9 sm:py-10"
      >
        <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="flex flex-col items-start gap-4">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-green">
              <ShieldCheck aria-hidden="true" className="size-4" />
              {t("personal.home.hero.eyebrow")}
              <span className="font-normal text-fg-muted">
                · {name ? t("personal.hello", { name }) : t("personal.helloAnon")}
              </span>
            </p>
            <h1
              id="personal-hero-title"
              className={cn("text-3xl leading-tight font-bold text-ink sm:text-[2.5rem]", display)}
            >
              {t("personal.home.hero.title")}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-ink/75">
              {t("personal.home.hero.body")}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Link
                to="/new"
                data-testid="personal-hero-check"
                className="inline-flex h-13 items-center gap-2.5 rounded-full bg-green px-7 text-base font-bold text-white shadow-[0_10px_24px_-12px_rgb(11_110_79/0.8)] transition-colors hover:bg-green-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green [&_svg]:size-5"
              >
                <Upload aria-hidden="true" />
                {t("personal.home.hero.cta")}
              </Link>
              <Link
                to="/rules"
                className="inline-flex h-13 items-center gap-2 rounded-full px-4 text-sm font-medium text-green hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-green [&_svg]:size-4"
              >
                <BookOpen aria-hidden="true" />
                {t("personal.home.hero.rules")}
              </Link>
            </div>
            <ul className="mt-1 flex flex-col gap-2 text-sm text-ink/80">
              {(["content", "authorities", "evidence"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green" />
                  {t(`personal.home.hero.point.${k}` as TKey)}
                </li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Four actions in priority order: check (dominant), smart correction, Ask SALEEM, Studio */}
      <section aria-labelledby="personal-actions">
        <h2 id="personal-actions" className="sr-only">
          {t("personal.home.actions")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <Link
            to="/new"
            data-testid="personal-check"
            className="group flex min-h-40 flex-col justify-between gap-4 rounded-[22px] bg-forest p-6 sm:min-h-44 text-white shadow-[0_16px_40px_-24px_rgb(7_33_26/0.9)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green sm:col-span-3 lg:col-span-1"
          >
            <span className="flex items-center justify-between">
              <span className="grid size-12 place-items-center rounded-full bg-white/10 text-mint [&_svg]:size-6">
                <ScanSearch aria-hidden="true" />
              </span>
              <ArrowLeft
                aria-hidden="true"
                className="size-5 text-mint transition-transform group-hover:-translate-x-1 ltr:rotate-180 ltr:group-hover:translate-x-1"
              />
            </span>
            <span className="flex flex-col gap-1.5">
              <span className={cn("text-xl font-bold", display)}>
                {t("personal.home.action.check")}
              </span>
              <span className="text-sm leading-relaxed text-white/75">
                {t("personal.home.action.checkBody")}
              </span>
            </span>
          </Link>
          <ActionCard
            to={fixTarget ? `/promotions/${fixTarget.id}/fix` : "/promotions"}
            icon={<Wand2 />}
            title={t("personal.home.action.fix")}
            body={
              fixTarget
                ? t("personal.home.action.fixBody", { title: fixTarget.title })
                : t("personal.home.action.fixEmpty")
            }
            testId="personal-fix"
          />
          <ActionCard
            to="/ask"
            icon={<MessageCircleQuestion />}
            title={t("personal.home.action.ask")}
            body={t("personal.home.action.askBody")}
            testId="personal-ask"
          />
          <ActionCard
            to="/studio"
            icon={<Sparkles />}
            title={t("personal.home.action.create")}
            body={t("personal.home.action.createBody")}
            testId="personal-create"
          />
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Recent results */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className={cn("text-lg font-bold", display)}>
                {t("personal.home.recent.title")}
              </h2>
              {list.length > 0 && (
                <Link
                  to="/promotions"
                  className="rounded-sm text-sm font-medium text-green hover:underline focus-visible:outline-2 focus-visible:outline-green"
                >
                  {t("personal.home.recent.all")}
                </Link>
              )}
            </div>
            {promos.isPending ? (
              <Skeleton className="h-56" />
            ) : promos.isError ? (
              <ErrorState title={t("errors.generic")} onRetry={() => void promos.refetch()} />
            ) : list.length === 0 ? (
              <FirstSteps />
            ) : (
              <ul className="flex flex-col gap-1" data-testid="personal-recent">
                {recent.map((p) => {
                  const r = personalResult(p);
                  const card = p.current ? cards.data?.get(p.current.id) : undefined;
                  const counted =
                    (r.key === "ready" || r.key === "needs_fixes" || r.key === "review") &&
                    card &&
                    card.violations !== null;
                  return (
                    <li key={p.id}>
                      <Link
                        to="/promotions/$id"
                        params={{ id: p.id }}
                        className="group flex items-center gap-3 rounded-[16px] border border-transparent p-2 transition-colors hover:border-border hover:bg-sunken/60 focus-visible:outline-2 focus-visible:outline-green sm:gap-4"
                      >
                        <Thumb card={card} title={p.title} kind={p.current?.kind ?? null} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium group-hover:text-green">
                            {p.title}
                          </span>
                          <span className="text-xs text-fg-muted">
                            {t("personal.version", { n: p.current?.version_no ?? 1 })} ·{" "}
                            {date(p.updated_at)}
                          </span>
                          {counted && (
                            <span className="text-xs text-fg-muted">
                              {card.violations! + (card.warnings ?? 0) === 0
                                ? t("personal.home.recent.clean")
                                : t("personal.home.recent.findings", {
                                    v: card.violations!,
                                    w: card.warnings ?? 0,
                                  })}
                            </span>
                          )}
                          {/* Phones: the status goes under the title so the title keeps the width. */}
                          <span className="mt-1 sm:hidden">
                            <StatusChip tone={r.tone} size="sm">
                              {t(`personal.result.${r.key}` as TKey)}
                            </StatusChip>
                          </span>
                        </span>
                        <span className="hidden sm:block">
                          <StatusChip tone={r.tone} size="sm">
                            {t(`personal.result.${r.key}` as TKey)}
                          </StatusChip>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {/* Corrections and comparisons, drafts, saved videos: compact, only when there is something */}
          {hasLists && (
            <div className="grid items-start gap-6 md:grid-cols-2">
              {(corrections.data ?? []).length > 0 && (
                <MiniList
                  title={t("personal.home.corrections.title")}
                  hint={t("personal.home.corrections.hint")}
                >
                  {corrections.data!.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/promotions/$id"
                        params={{ id: c.promotion_id }}
                        className={rowLink}
                      >
                        <GitCompareArrows aria-hidden="true" className="size-4 text-gold-deep" />
                        <span className="min-w-0 flex-1 truncate">{titleOf(c.promotion_id)}</span>
                        <span className="text-xs text-fg-muted">
                          {t(`personal.method.${c.method}` as TKey)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </MiniList>
              )}
              {studioDrafts.length + unanalysed.length > 0 && (
                <MiniList title={t("personal.home.continue")}>
                  {studioDrafts.slice(0, 3).map((d) => (
                    <li key={d.id}>
                      <Link to="/studio" search={{ draft: d.id }} className={rowLink}>
                        <Sparkles aria-hidden="true" className="size-4 text-green" />
                        <span className="min-w-0 flex-1 truncate">
                          {d.brief.product.name || t("personal.untitledDraft")}
                        </span>
                        <span className="text-xs text-fg-muted">{t("personal.studioDraft")}</span>
                      </Link>
                    </li>
                  ))}
                  {unanalysed.slice(0, 3).map((p) => (
                    <li key={p.id}>
                      <Link to="/promotions/$id" params={{ id: p.id }} className={rowLink}>
                        <FilePenLine aria-hidden="true" className="size-4 text-fg-muted" />
                        <span className="min-w-0 flex-1 truncate">{p.title}</span>
                        <span className="text-xs text-fg-muted">{t("personal.notAnalysed")}</span>
                      </Link>
                    </li>
                  ))}
                </MiniList>
              )}
              {(videos.data ?? []).length > 0 && (
                <MiniList title={t("personal.videos")} testId="personal-videos">
                  {videos.data!.slice(0, 5).map((v) => (
                    <li key={v.id}>
                      <Link
                        to={v.promotion_id ? "/promotions/$id" : "/checks/$id"}
                        params={{ id: v.promotion_id ?? v.id }}
                        className={rowLink}
                      >
                        <Film aria-hidden="true" className="size-4 text-fg-muted" />
                        <span className="min-w-0 flex-1 truncate">{v.title ?? "—"}</span>
                        <span className="text-xs text-fg-muted">
                          {t("personal.version", { n: v.version_no ?? 1 })}
                          {v.duration_seconds ? ` · ${clock(v.duration_seconds)}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </MiniList>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Next step */}
          {next && (
            <section
              aria-labelledby="personal-next"
              className="flex flex-col gap-3 rounded-[20px] border border-gold/40 bg-cream p-5"
              data-testid="personal-next"
            >
              <h2
                id="personal-next"
                className="flex items-center gap-2 text-sm font-bold text-gold-deep"
              >
                <Lightbulb aria-hidden="true" className="size-4" />
                {t("personal.home.next.title")}
              </h2>
              <p className="text-sm leading-relaxed text-ink">{next.body}</p>
              <Link
                to={next.to}
                className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
              >
                {next.cta}
                <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
              </Link>
            </section>
          )}

          {/* Usage summary */}
          <Card className="flex flex-col" data-testid="personal-usage">
            <h2 className={cn("mb-1 text-lg font-bold", display)}>
              {t("personal.home.usage.title")}
            </h2>
            {promos.isPending ? (
              <Skeleton className="h-32" />
            ) : (
              <dl className="flex flex-col divide-y divide-border">
                {usage.map(([k, n, icon, tone]) => (
                  <div key={k} className="flex items-center gap-3 py-2.5">
                    <span className={cn("[&_svg]:size-4", tone)} aria-hidden="true">
                      {icon}
                    </span>
                    <dt className="flex-1 text-sm text-fg-muted">
                      {t(`personal.home.usage.${k}` as TKey)}
                    </dt>
                    <dd className={cn("text-xl font-bold tabular-nums", tone)}>{n}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {/* AI allowance (compact) */}
          <Card className="flex flex-col gap-3" data-testid="personal-allowance">
            <h2 className="text-sm font-bold">{t("personal.allowance")}</h2>
            {allowances.isPending ? (
              <Skeleton className="h-24" />
            ) : !allowances.data ? (
              <p className="text-sm text-fg-muted">{t("personal.allowanceUnavailable")}</p>
            ) : (
              (["analysis", "script", "correction", "ask"] as const).map((k) => {
                const a = allowances.data![k];
                return (
                  <div key={k} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span>{t(`personal.capability.${k}` as TKey)}</span>
                      <span className="tabular-nums text-fg-muted">
                        {a.used} / {a.limit}
                      </span>
                    </div>
                    <ProgressBar
                      value={a.limit ? (a.used / a.limit) * 100 : 100}
                      label={t(`personal.capability.${k}` as TKey)}
                      tone={a.ok ? "green" : "red"}
                    />
                  </div>
                );
              })
            )}
            <p className="text-xs leading-relaxed text-fg-muted">
              {workspace.is_demo ? t("personal.allowanceDemo") : t("personal.allowanceNote")}
            </p>
          </Card>
        </div>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t("personal.advisory")}
      </p>
    </Page>
  );
}

function MiniList({
  title,
  hint,
  testId,
  children,
}: {
  title: string;
  hint?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-sm font-bold">{title}</h2>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
      <ul className="flex flex-col" data-testid={testId}>
        {children}
      </ul>
    </Card>
  );
}

/** Real preview of the version (signed thumbnail) with its duration, or an icon for its media kind. */
function Thumb({ card, title, kind }: { card?: VersionCard; title: string; kind: string | null }) {
  const { t } = useI18n();
  const Icon = kind === "image" ? ImageIcon : kind === "video" ? Film : FileText;
  return (
    <span className="relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-[12px] bg-sunken text-fg-muted sm:h-[72px] sm:w-28">
      {card?.previewUrl ? (
        <img
          src={card.previewUrl}
          alt={t("personal.home.recent.preview", { title })}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <Icon aria-hidden="true" className="size-6" />
      )}
      {card?.durationSeconds ? (
        <span
          dir="ltr"
          className="absolute end-1 bottom-1 rounded bg-ink/75 px-1 text-[11px] leading-4 font-medium text-white tabular-nums"
        >
          {clock(card.durationSeconds)}
        </span>
      ) : null}
    </span>
  );
}

/** Empty state for a new user: the three steps of a check and the primary action. */
function FirstSteps() {
  const { t } = useI18n();
  return (
    <div
      className="flex flex-col gap-4 rounded-[18px] border border-dashed border-green/30 bg-green-bg/40 p-5"
      data-testid="personal-first-steps"
    >
      <div>
        <p className="font-bold">{t("personal.home.empty.title")}</p>
        <p className="text-sm text-fg-muted">{t("personal.home.empty.body")}</p>
      </div>
      <ol className="flex flex-col gap-3">
        {(["step1", "step2", "step3"] as const).map((k, i) => (
          <li key={k} className="flex items-start gap-3 text-sm">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-green text-xs font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-1">{t(`personal.home.empty.${k}` as TKey)}</span>
          </li>
        ))}
      </ol>
      <Link
        to="/new"
        className="inline-flex h-11 items-center gap-2 self-start rounded-full bg-green px-5 text-sm font-bold text-white hover:bg-green-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
      >
        <Upload aria-hidden="true" className="size-4" />
        {t("personal.home.hero.cta")}
      </Link>
    </div>
  );
}

/**
 * Illustration of what a check inspects — no result, score or finding is shown, so nothing is fabricated: an ad
 * preview and the four inputs SALEEM really analyses (speech, on-screen text and caption, frames, applicable rules).
 */
function HeroVisual() {
  const { t } = useI18n();
  const rows: [string, ReactNode][] = [
    ["speech", <Mic key="i" />],
    ["text", <Type key="i" />],
    ["frames", <Film key="i" />],
    ["rules", <Scale key="i" />],
  ];
  return (
    <figure aria-hidden="true" className="relative mx-auto hidden w-full max-w-md md:block">
      <div className="rounded-[22px] border border-white/80 bg-white/70 p-3 shadow-[0_30px_60px_-35px_rgb(7_33_26/0.6)]">
        <div className="relative grid aspect-video place-items-center overflow-hidden rounded-[16px] bg-[linear-gradient(140deg,var(--color-forest-2),var(--color-green))]">
          <div className="absolute inset-x-6 bottom-5 h-1.5 rounded-full bg-white/20">
            <div className="h-full w-2/5 rounded-full bg-mint" />
          </div>
          <span className="grid size-14 place-items-center rounded-full bg-white/90 text-forest shadow-lg">
            <Play className="size-6 translate-x-0.5" fill="currentColor" />
          </span>
          <span className="absolute end-3 top-3 grid size-10 place-items-center rounded-full bg-white/95 shadow">
            <svg viewBox={MARK_VIEWBOX} className="size-6">
              <path fill={LOGO_COLORS.mark} fillRule="evenodd" d={MARK_PATH} />
            </svg>
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="px-1 text-xs font-medium text-fg-muted">
            {t("personal.home.hero.visual.caption")}
          </p>
          {rows.map(([k, icon]) => (
            <div
              key={k}
              className="flex items-center gap-2.5 rounded-[12px] bg-white px-3 py-2 text-sm text-ink"
            >
              <span className="grid size-7 place-items-center rounded-full bg-green-bg text-green [&_svg]:size-3.5">
                {icon}
              </span>
              <span className="flex-1">{t(`personal.home.hero.visual.${k}` as TKey)}</span>
              <ScanSearch className="size-4 text-green/60" />
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}

function ActionCard({
  to,
  icon,
  title,
  body,
  testId,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  body: string;
  testId: string;
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="group flex flex-col justify-between gap-3 rounded-[22px] border border-border bg-card p-5 sm:min-h-44 sm:gap-4 text-ink transition-[transform,border-color] hover:-translate-y-0.5 hover:border-green/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
    >
      <span className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-full bg-green-bg text-green [&_svg]:size-5">
          {icon}
        </span>
        <ArrowLeft
          aria-hidden="true"
          className="size-4 text-fg-muted transition-transform group-hover:-translate-x-0.5 ltr:rotate-180"
        />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-bold">{title}</span>
        <span className="line-clamp-3 text-sm leading-relaxed text-fg-muted">{body}</span>
      </span>
    </Link>
  );
}
