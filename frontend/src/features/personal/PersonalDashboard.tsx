import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FilePenLine,
  FileSearch,
  Film,
  Info,
  MessageCircleQuestion,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  Card,
  CardTitle,
  ErrorState,
  Page,
  ProgressBar,
  Skeleton,
  StatusChip,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { listPromotions, type PromotionListItem } from "@/lib/api/promotions";
import { listDrafts } from "@/lib/api/studio";
import {
  fetchPersonalAllowances,
  listPersonalCorrections,
  listSavedVideos,
  type PersonalWorkspace,
} from "@/lib/api/personal";
import { cn } from "@/lib/utils";

/** The personal result of an advertisement: the automated result of its current version (never an approval). */
export function personalResult(p: Pick<PromotionListItem, "current">): {
  key: "none" | "running" | "failed" | "ready" | "needs_fixes" | "review";
  tone: "neutral" | "processing" | "violation" | "ready" | "warning";
} {
  const v = p.current;
  if (!v) return { key: "none", tone: "neutral" };
  if (v.status === "failed") return { key: "failed", tone: "violation" };
  if (v.status !== "done") return { key: "running", tone: "processing" };
  if (v.overall_status === "ready") return { key: "ready", tone: "ready" };
  if (v.overall_status === "needs_fixes") return { key: "needs_fixes", tone: "violation" };
  return { key: "review", tone: "warning" };
}

/**
 * D211 «مساحتي الشخصية»: the individual's home. Four actions (create, check, smart correction, Ask SALEEM), then the
 * user's own advertisements, analysis results, drafts, corrections, saved videos and AI allowance — all read from
 * the server (RLS: own rows only). No organisation, review queue or approval anywhere.
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
  const analysed = list.filter((p) => p.current?.status === "done");
  const toFix = analysed.filter((p) => p.current?.overall_status !== "ready");
  const unanalysed = list.filter((p) => !p.current || p.current.status === "queued");
  const studioDrafts = (drafts.data ?? []).filter((d) => d.org_id === null);
  const titleOf = (id: string) => list.find((p) => p.id === id)?.title ?? "—";
  const name =
    workspace.display_name ?? (user?.user_metadata?.["display_name"] as string | undefined);
  const date = (s: string) =>
    new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "short",
    });

  return (
    <Page className="flex flex-col gap-8">
      {/* Welcome */}
      <section
        data-testid="personal-dashboard"
        className="relative overflow-hidden rounded-[28px] bg-cream px-5 py-7 sm:px-9 sm:py-10"
      >
        <div
          aria-hidden="true"
          className="absolute -top-16 size-56 rounded-full bg-gold/25 blur-2xl ltr:-right-10 rtl:-left-10"
        />
        <div className="relative flex flex-col gap-2">
          <p className="text-sm font-medium text-gold-deep">
            {name ? t("personal.hello", { name }) : t("personal.helloAnon")}
            {workspace.is_demo && (
              <span className="ms-2 rounded-full bg-white/70 px-2 py-0.5 text-xs text-ink">
                {t("workspace.demo")}
              </span>
            )}
          </p>
          <h1
            className={cn(
              "text-3xl font-bold text-ink sm:text-4xl",
              lang === "ar" ? "font-display" : "tracking-tight",
            )}
          >
            {t("personal.title")}
          </h1>
          <p className="max-w-2xl text-ink/75">{t("personal.subtitle")}</p>
        </div>
      </section>

      {/* Four actions */}
      <section aria-labelledby="personal-actions" className="flex flex-col gap-3">
        <h2 id="personal-actions" className="sr-only">
          {t("personal.actionsTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            to="/studio"
            icon={<Wand2 />}
            tone="forest"
            title={t("personal.action.create")}
            body={t("personal.action.createBody")}
            testId="personal-create"
          />
          <ActionCard
            to="/new"
            icon={<FileSearch />}
            tone="mint"
            title={t("personal.action.check")}
            body={t("personal.action.checkBody")}
            testId="personal-check"
          />
          <ActionCard
            to={toFix[0] ? `/promotions/${toFix[0].id}/fix` : "/promotions"}
            icon={<Sparkles />}
            tone="gold"
            title={t("personal.action.fix")}
            body={
              toFix[0]
                ? t("personal.action.fixBody", { title: toFix[0].title })
                : t("personal.action.fixEmpty")
            }
            testId="personal-fix"
          />
          <ActionCard
            to="/ask"
            icon={<MessageCircleQuestion />}
            tone="cream"
            title={t("personal.action.ask")}
            body={t("personal.action.askBody")}
            testId="personal-ask"
          />
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t("personal.advisory")}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {/* Recent advertisements and results */}
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("personal.recent")}</CardTitle>
              <Link to="/promotions" className="text-sm font-medium text-green hover:underline">
                {t("personal.library")}
              </Link>
            </div>
            {promos.isPending ? (
              <Skeleton className="h-40" />
            ) : promos.isError ? (
              <ErrorState title={t("errors.generic")} onRetry={() => void promos.refetch()} />
            ) : list.length === 0 ? (
              <p className="rounded-[14px] bg-sunken px-4 py-6 text-center text-sm text-fg-muted">
                {t("personal.emptyAds")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border" data-testid="personal-recent">
                {list.slice(0, 6).map((p) => {
                  const r = personalResult(p);
                  return (
                    <li key={p.id}>
                      <Link
                        to="/promotions/$id"
                        params={{ id: p.id }}
                        className="flex items-center gap-3 py-3 hover:text-green"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{p.title}</span>
                          <span className="text-xs text-fg-muted">
                            {t("personal.version", { n: p.current?.version_no ?? 1 })} ·{" "}
                            {date(p.updated_at)}
                          </span>
                        </span>
                        <StatusChip tone={r.tone} size="sm">
                          {t(`personal.result.${r.key}` as TKey)}
                        </StatusChip>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Analysis results */}
          <Card className="flex flex-col gap-3">
            <CardTitle>{t("personal.results")}</CardTitle>
            {analysed.length === 0 ? (
              <p className="text-sm text-fg-muted">{t("personal.emptyResults")}</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {(["ready", "needs_fixes", "review"] as const).map((k) => {
                  const n = analysed.filter((p) => personalResult(p).key === k).length;
                  return (
                    <div key={k} className="rounded-[14px] border border-border p-3">
                      <p className="text-2xl font-bold">{n}</p>
                      <p className="text-xs text-fg-muted">{t(`personal.result.${k}` as TKey)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Drafts */}
          <Card className="flex flex-col gap-3">
            <CardTitle>{t("personal.drafts")}</CardTitle>
            {studioDrafts.length + unanalysed.length === 0 ? (
              <p className="text-sm text-fg-muted">{t("personal.emptyDrafts")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {studioDrafts.slice(0, 4).map((d) => (
                  <li key={d.id}>
                    <Link
                      to="/studio"
                      search={{ draft: d.id }}
                      className="flex items-center gap-3 rounded-[12px] bg-sunken/60 px-3 py-2.5 hover:bg-sunken"
                    >
                      <Wand2 aria-hidden="true" className="size-4 text-green" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {d.brief.product.name || t("personal.untitledDraft")}
                      </span>
                      <span className="text-xs text-fg-muted">{t("personal.studioDraft")}</span>
                    </Link>
                  </li>
                ))}
                {unanalysed.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/promotions/$id"
                      params={{ id: p.id }}
                      className="flex items-center gap-3 rounded-[12px] bg-sunken/60 px-3 py-2.5 hover:bg-sunken"
                    >
                      <FilePenLine aria-hidden="true" className="size-4 text-fg-muted" />
                      <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                      <span className="text-xs text-fg-muted">{t("personal.notAnalysed")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {/* AI allowance */}
          <Card className="flex flex-col gap-3" data-testid="personal-allowance">
            <CardTitle>{t("personal.allowance")}</CardTitle>
            {allowances.isPending ? (
              <Skeleton className="h-28" />
            ) : !allowances.data ? (
              <p className="text-sm text-fg-muted">{t("personal.allowanceUnavailable")}</p>
            ) : (
              (["analysis", "script", "correction", "ask"] as const).map((k) => {
                const a = allowances.data![k];
                return (
                  <div key={k} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
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

          {/* Recently corrected */}
          <Card className="flex flex-col gap-3">
            <CardTitle>{t("personal.corrected")}</CardTitle>
            {(corrections.data ?? []).length === 0 ? (
              <p className="text-sm text-fg-muted">{t("personal.emptyCorrected")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {corrections.data!.map((c) => (
                  <li key={c.id}>
                    <Link
                      to="/promotions/$id"
                      params={{ id: c.promotion_id }}
                      className="flex items-center gap-2 text-sm hover:text-green"
                    >
                      <Sparkles aria-hidden="true" className="size-4 text-gold-deep" />
                      <span className="min-w-0 flex-1 truncate">{titleOf(c.promotion_id)}</span>
                      <span className="text-xs text-fg-muted">
                        {t(`personal.method.${c.method}` as TKey)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Saved videos */}
          <Card className="flex flex-col gap-3">
            <CardTitle>{t("personal.videos")}</CardTitle>
            {(videos.data ?? []).length === 0 ? (
              <p className="text-sm text-fg-muted">{t("personal.emptyVideos")}</p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="personal-videos">
                {videos.data!.map((v) => (
                  <li key={v.id}>
                    <Link
                      to={v.promotion_id ? "/promotions/$id" : "/checks/$id"}
                      params={{ id: v.promotion_id ?? v.id }}
                      className="flex items-center gap-2 text-sm hover:text-green"
                    >
                      <Film aria-hidden="true" className="size-4 text-fg-muted" />
                      <span className="min-w-0 flex-1 truncate">{v.title ?? "—"}</span>
                      <span className="text-xs text-fg-muted">
                        {t("personal.version", { n: v.version_no ?? 1 })}
                        {v.duration_seconds
                          ? ` · ${Math.round(v.duration_seconds)} ${t("personal.seconds")}`
                          : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </Page>
  );
}

function ActionCard({
  to,
  icon,
  title,
  body,
  tone,
  testId,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  body: string;
  tone: "forest" | "mint" | "gold" | "cream";
  testId: string;
}) {
  const tones = {
    forest: "bg-forest text-white [&_.ic]:bg-white/10 [&_.ic]:text-gold [&_.bd]:text-white/75",
    mint: "bg-green-bg text-ink [&_.ic]:bg-white [&_.ic]:text-green [&_.bd]:text-fg-muted",
    gold: "bg-amber-bg text-ink [&_.ic]:bg-white [&_.ic]:text-gold-deep [&_.bd]:text-fg-muted",
    cream:
      "bg-card border border-border text-ink [&_.ic]:bg-cream [&_.ic]:text-gold-deep [&_.bd]:text-fg-muted",
  } as const;
  return (
    <Link
      to={to}
      data-testid={testId}
      className={cn(
        "group flex min-h-40 flex-col justify-between gap-4 rounded-[22px] p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-green",
        tones[tone],
      )}
    >
      <span className="ic grid size-11 place-items-center rounded-full [&_svg]:size-5">{icon}</span>
      <span className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-2 text-lg font-bold">
          {title}
          <ArrowLeft
            aria-hidden="true"
            className="size-4 opacity-60 transition-transform group-hover:-translate-x-0.5 ltr:rotate-180"
          />
        </span>
        <span className="bd line-clamp-2 text-sm leading-relaxed">{body}</span>
      </span>
    </Link>
  );
}
