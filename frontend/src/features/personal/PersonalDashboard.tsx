import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
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
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Type,
  Upload,
  CloudUpload,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, ErrorState, Page, ProgressBar, Skeleton, StatusChip } from "@/components/ui";
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
 * «مساحتي الشخصية» (D211, redesigned D219 and D222): the individual's home. Checking an advertisement against the applicable
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
    <Page className="flex flex-col gap-6">
      {/* 1. The check panel: what SALEEM does, how, and the one primary action */}
      <section
        data-testid="personal-dashboard"
        aria-labelledby="personal-hero-title"
        className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_60px_-40px_rgb(7_33_26/0.45)]"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-[auto_1fr]">
          <div className="p-6 pb-5 sm:p-9 sm:pb-6 lg:col-start-1 lg:row-start-1">
            <div className="flex flex-col gap-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-bg px-2.5 py-1 font-medium text-green">
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  {t("personal.home2.eyebrow")}
                </span>
                <span className="text-fg-muted">
                  {name ? t("personal.hello", { name }) : t("personal.helloAnon")}
                </span>
              </p>
              <h1
                id="personal-hero-title"
                className={cn("text-3xl leading-snug font-bold text-ink sm:text-4xl", display)}
              >
                {t("personal.home2.titleA")}{" "}
                <span className="text-green">{t("personal.home2.titleB")}</span>
              </h1>
              <p className="max-w-2xl leading-relaxed text-fg-muted">{t("personal.home2.body")}</p>
            </div>
          </div>

          <div className="flex border-y border-border lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-y-0 bg-[linear-gradient(165deg,var(--color-green-bg),var(--color-cream)_70%)] p-5 sm:p-7 lg:border-t-0 lg:border-s">
            <Link
              to="/new"
              data-testid="personal-check"
              className="group flex w-full flex-col items-center justify-center gap-4 rounded-[22px] border-2 border-dashed border-green/30 bg-white/75 px-6 py-8 text-center transition-colors hover:border-green/70 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
            >
              <span className="grid size-16 place-items-center rounded-full bg-green text-white shadow-[0_12px_28px_-12px_rgb(11_110_79/0.9)] transition-transform group-hover:-translate-y-0.5 [&_svg]:size-7">
                <CloudUpload aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-1">
                <span className={cn("text-xl font-bold text-ink", display)}>
                  {t("personal.home2.drop.title")}
                </span>
                <span className="text-sm text-fg-muted">{t("personal.home2.drop.body")}</span>
              </span>
              <span className="flex flex-wrap justify-center gap-1.5">
                {formats.map(([k, icon]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs text-fg-muted [&_svg]:size-3.5"
                  >
                    {icon}
                    {t(`personal.home2.drop.${k}` as TKey)}
                  </span>
                ))}
              </span>
              <span className="inline-flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-green px-6 font-bold text-white transition-colors group-hover:bg-green-hover">
                {t("personal.home2.drop.cta")}
                <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
              </span>
              <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                <ShieldCheck aria-hidden="true" className="size-3.5 text-green" />
                {t("personal.home2.drop.note")}
              </span>
            </Link>
          </div>

          <div className="p-6 pt-5 sm:p-9 sm:pt-0 lg:col-start-1 lg:row-start-2">
            <h2 className="mb-3 text-xs font-semibold text-fg-muted">
              {t("personal.home2.steps")}
            </h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {steps.map(([k, icon], i) => (
                <li
                  key={k}
                  className="flex gap-3 rounded-[18px] border border-border bg-paper/60 p-4"
                >
                  <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white text-green shadow-[0_2px_8px_-2px_rgb(7_33_26/0.25)] [&_svg]:size-[18px]">
                    {icon}
                    <span className="absolute -end-1 -top-1 grid size-5 place-items-center rounded-full bg-green text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-bold text-ink">
                      {t(`personal.home2.${k}.title` as TKey)}
                    </span>
                    <span className="text-xs leading-relaxed text-fg-muted">
                      {t(`personal.home2.${k}.body` as TKey)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* 2. Supporting tools, deliberately smaller than the check */}
      <section aria-labelledby="personal-tools">
        <h2 id="personal-tools" className="mb-3 text-sm font-bold text-ink">
          {t("personal.home2.tools")}
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <ToolCard
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
          <ToolCard
            to="/ask"
            icon={<MessageCircleQuestion />}
            title={t("personal.home.action.ask")}
            body={t("personal.home.action.askBody")}
            testId="personal-ask"
          />
          <ToolCard
            to="/studio"
            icon={<Sparkles />}
            title={t("personal.home.action.create")}
            body={t("personal.home.action.createBody")}
            testId="personal-create"
          />
        </div>
      </section>

      {/* 3. Results first, then the next step and the allowance */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className={cn("text-lg font-bold", display)}>
                {t("personal.home.recent.title")}
              </h2>
              {list.length > 0 && (
                <Link
                  to="/promotions"
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-green hover:underline focus-visible:outline-2 focus-visible:outline-green"
                >
                  {t("personal.home.recent.all")}
                  <ArrowLeft aria-hidden="true" className="size-3.5 ltr:rotate-180" />
                </Link>
              )}
            </div>
            {analysed.length > 0 && (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="personal-usage">
                {usage.map(([k, n, icon, tone]) => (
                  <div
                    key={k}
                    className="flex flex-col gap-1.5 rounded-[14px] bg-sunken/70 px-3 py-2.5"
                  >
                    <dt className="flex items-center gap-1.5 text-xs text-fg-muted [&_svg]:size-3.5">
                      <span className={tone} aria-hidden="true">
                        {icon}
                      </span>
                      {t(`personal.home.usage.${k}` as TKey)}
                    </dt>
                    <dd className={cn("text-2xl leading-none font-bold tabular-nums", tone)}>
                      {n}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {promos.isPending ? (
              <Skeleton className="h-56" />
            ) : promos.isError ? (
              <ErrorState title={t("errors.generic")} onRetry={() => void promos.refetch()} />
            ) : list.length === 0 ? (
              <FirstSteps />
            ) : (
              <ul
                className="-mx-2 flex flex-col divide-y divide-border"
                data-testid="personal-recent"
              >
                {recent.map((p) => {
                  const r = personalResult(p);
                  const card = p.current ? cards.data?.get(p.current.id) : undefined;
                  const counted =
                    (r.key === "ready" || r.key === "needs_fixes" || r.key === "review") &&
                    card &&
                    card.violations !== null;
                  const chip = (
                    <StatusChip tone={r.tone} size="sm">
                      {t(`personal.result.${r.key}` as TKey)}
                    </StatusChip>
                  );
                  return (
                    <li key={p.id}>
                      <Link
                        to="/promotions/$id"
                        params={{ id: p.id }}
                        className="group flex items-center gap-3 rounded-[16px] px-2 py-3 transition-colors hover:bg-sunken/60 focus-visible:outline-2 focus-visible:outline-green sm:gap-4"
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
                          <span className="mt-1 sm:hidden">{chip}</span>
                        </span>
                        <span className="hidden sm:block">{chip}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

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

        <aside className="flex flex-col gap-6">
          {next && (
            <section
              aria-labelledby="personal-next"
              className="flex flex-col gap-3 rounded-[22px] bg-forest p-5 text-white"
              data-testid="personal-next"
            >
              <h2
                id="personal-next"
                className="flex items-center gap-2 text-sm font-bold text-gold"
              >
                <Lightbulb aria-hidden="true" className="size-4" />
                {t("personal.home.next.title")}
              </h2>
              <p className="text-sm leading-relaxed text-white/85">{next.body}</p>
              <Link
                to={next.to}
                className="inline-flex h-10 items-center gap-2 self-start rounded-full bg-white px-4 text-sm font-bold text-forest hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {next.cta}
                <ArrowLeft aria-hidden="true" className="size-4 ltr:rotate-180" />
              </Link>
            </section>
          )}

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
        </aside>
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        {t("personal.advisory")}
      </p>
    </Page>
  );
}

const steps: [string, ReactNode][] = [
  ["step1", <Upload key="i" />],
  ["step2", <Scale key="i" />],
  ["step3", <Wand2 key="i" />],
];
const formats: [string, ReactNode][] = [
  ["video", <Film key="i" />],
  ["image", <ImageIcon key="i" />],
  ["text", <Type key="i" />],
];

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

/** A supporting tool: compact and horizontal, so the check panel stays the primary action. */
function ToolCard({
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
      className="group flex items-center gap-3.5 rounded-[18px] border border-border bg-card p-4 transition-colors hover:border-green/40 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-green-bg text-green [&_svg]:size-5">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold text-ink">{title}</span>
        <span className="line-clamp-2 text-xs leading-relaxed text-fg-muted">{body}</span>
      </span>
      <ArrowLeft
        aria-hidden="true"
        className="size-4 shrink-0 text-fg-muted transition-transform group-hover:-translate-x-0.5 ltr:rotate-180 ltr:group-hover:translate-x-0.5"
      />
    </Link>
  );
}
