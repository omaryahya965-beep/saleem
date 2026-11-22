import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  FileCheck2,
  Info,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MobileActionBar } from "@/components/layout/SiteShell";
import {
  Badge,
  Button,
  Card,
  Dialog,
  IconButton,
  IssueCard,
  Page,
  StatusChip,
  toast,
  type IssueView,
} from "@/components/ui";
import { formatClock, useI18n } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { deleteMedia, type ReportBundle } from "@/lib/api/data";
import { qk, useRulebook } from "@/lib/api/hooks";
import { rerunSubmission } from "@/lib/api/features";
import { ShareDialog } from "@/features/share/SharePages";
import { cn } from "@/lib/utils";
import { MediaPanel, TranscriptPanel } from "./MediaPanel";
import { countBySeverity, diffFindings, sortIssues, toIssueViews } from "./model";
import { CoverageBanner, RuleOutcomes, coverageOf } from "./RuleOutcomes";
import { FindingsWorkspace, type WorkspaceContext } from "@/features/review/FindingsWorkspace";
import { groupFindings } from "./grouping";
import { RunCoverageTable, type RunCoverage } from "@/features/personal/RegulatoryCoverage";

type Tone = "violation" | "warning" | "ready";

export function Disclaimer({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cn("flex items-start gap-2 text-sm text-fg-muted", className)}>
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {t("brand.disclaimer")} {t("promo.advisory")} {t("report.illustrativeNote")}
      </span>
    </p>
  );
}

function StatusBand({
  tone,
  title,
  summary,
  facts,
  actions,
}: {
  tone: Tone;
  title: string;
  summary: string;
  facts: { label: string; value: ReactNode; ltr?: boolean }[];
  actions: ReactNode;
}) {
  const { lang } = useI18n();
  const Icon = tone === "ready" ? CircleCheck : tone === "warning" ? TriangleAlert : CircleX;
  return (
    <section
      aria-labelledby="report-status"
      className={cn(
        "rounded-lg border p-5 sm:p-7",
        tone === "violation" && "border-red/20 bg-red-bg",
        tone === "warning" && "border-amber/25 bg-amber-bg",
        tone === "ready" && "border-green/20 bg-green-bg",
      )}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-full text-white sm:size-14 [&_svg]:size-7",
              tone === "violation" && "bg-red",
              tone === "warning" && "bg-amber",
              tone === "ready" && "bg-green",
            )}
          >
            <Icon aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1
              id="report-status"
              className={cn(
                "text-3xl font-bold sm:text-4xl",
                lang === "ar" ? "font-display" : "tracking-tight",
                tone === "violation" && "text-red",
                tone === "warning" && "text-amber-text",
                tone === "ready" && "text-ready",
              )}
            >
              {title}
            </h1>
            <p className="mt-1 text-lg text-fg">{summary}</p>
          </div>
        </div>
        <div className="hidden shrink-0 flex-wrap gap-2 md:flex">{actions}</div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-ink/10 pt-4 sm:grid-cols-3 lg:grid-cols-5">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-xs text-fg-muted">{f.label}</dt>
            {/* Value sits directly under its label; LTR values (model ids) are isolated, not flipped. */}
            <dd className="m-0 truncate text-start text-sm font-medium text-fg">
              {f.ltr ? <bdi dir="ltr">{f.value}</bdi> : f.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReadyComparison({ bundle }: { bundle: ReportBundle }) {
  const { t, tn, lang, formatDate } = useI18n();
  const { parent, parentFindings, findings, rules } = bundle;
  if (!parent) return null;
  const { fixed, stillOpen } = diffFindings(parentFindings, findings);
  const fixedViews = toIssueViews(fixed, rules, lang);
  const parentCounts = countBySeverity(parentFindings);
  const parentTone: Tone =
    parent.overall_status === "ready"
      ? "ready"
      : parent.overall_status === "review"
        ? "warning"
        : "violation";
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{t("report.fixedHeading")}</h2>
        <p className="text-sm text-fg-muted">
          {t("report.fixedBody", { date: formatDate(parent.analyzed_at ?? parent.created_at) })}
        </p>
      </div>
      {fixedViews.length === 0 ? (
        <p className="text-fg-muted">{t("report.fixedEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {fixedViews.map((f) => (
            <li key={f.id} className="flex items-start gap-3 px-4 py-3">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-green" />
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-medium text-fg">{f.ruleTitle}</p>
                <p className="text-sm text-fg-muted line-through decoration-fg-muted/50">
                  {f.title}
                </p>
              </div>
              <Badge mono>{f.ruleCode}</Badge>
            </li>
          ))}
        </ul>
      )}
      {stillOpen.length > 0 && (
        <p className="text-sm text-amber-text">
          {t("report.stillOpen")}: {[...new Set(stillOpen.map((f) => f.rule_code))].join("، ")}
        </p>
      )}
      <Link
        to="/checks/$id"
        params={{ id: parent.id }}
        className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-sunken px-4 py-3 hover:border-border-strong"
      >
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs text-fg-muted">{t("report.previousVersion")}</p>
          <p className="truncate font-medium text-fg">{parent.title}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <StatusChip tone={parentTone} size="sm">
              {t(`status.${parent.overall_status ?? "needs_fixes"}`)}
            </StatusChip>
            <span className="text-xs text-fg-muted">
              {tn("count.violations", parentCounts.violations)} ·{" "}
              {tn("count.warnings", parentCounts.warnings)}
            </span>
          </div>
        </div>
        <span className="text-sm font-medium text-green">{t("report.openPrevious")}</span>
        <ArrowLeft aria-hidden="true" className="size-4 text-green ltr:rotate-180" />
      </Link>
    </Card>
  );
}

/** Compact automated-result summary for the advertisement workspace (replaces the large banner there). */
function ResultSummary({ bundle }: { bundle: ReportBundle }) {
  const { t, formatDate } = useI18n();
  const { submission: sub, findings, run } = bundle;
  const groups = groupFindings(findings);
  const violations = groups.filter((g) => g.severity === "violation").length;
  const warnings = groups.length - violations;
  const checks = bundle.ruleChecks;
  const passed = checks.filter((c) => c.outcome === "passed").length;
  const manual = checks.filter(
    (c) =>
      c.outcome === "unable_to_verify" ||
      c.reason_code === "document_required" ||
      c.reason_code === "reviewer_checklist",
  ).length;
  const coverage = coverageOf(bundle);
  const status = sub.overall_status ?? "ready";
  const tiles: { label: string; value: ReactNode; tone?: string }[] = [
    {
      label: t("ws.summary.violations"),
      value: violations,
      tone: violations ? "text-red" : undefined,
    },
    {
      label: t("ws.summary.warnings"),
      value: warnings,
      tone: warnings ? "text-amber-text" : undefined,
    },
    { label: t("ws.summary.passed"), value: checks.length ? passed : "—" },
    { label: t("ws.summary.manual"), value: checks.length ? manual : "—" },
    {
      label: t("ws.summary.coverage"),
      value: coverage
        ? t(
            coverage.status === "partial"
              ? "ws.summary.coveragePartial"
              : "ws.summary.coverageComplete",
          )
        : "—",
      tone: coverage?.status === "partial" ? "text-amber-text" : undefined,
    },
  ];
  const model = [run?.llm_model, run?.asr_model].filter(Boolean).join(" · ");
  return (
    <section
      aria-label={t("ws.summary.title")}
      data-testid="result-summary"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {t("ws.summary.title")}
          <StatusChip
            tone={status === "ready" ? "ready" : status === "review" ? "warning" : "violation"}
            size="sm"
          >
            {t(`status.${status}`)}
          </StatusChip>
        </h2>
        <p className="text-xs text-fg-muted">
          {t("ws.summary.meta", {
            date: formatDate(sub.analyzed_at ?? sub.created_at, true),
            rulebook: bundle.rulebookVersion ?? "—",
          })}
          {model ? (
            <>
              {" · "}
              <bdi dir="ltr">{model}</bdi>
            </>
          ) : null}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.label} className="rounded-md bg-sunken px-3 py-2">
            <dt className="text-xs text-fg-muted">{x.label}</dt>
            <dd className={cn("tabular text-xl font-bold", x.tone)}>{x.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-fg-muted">
        {t("ws.summary.groupedNote", { groups: groups.length, raw: findings.length })}
      </p>
    </section>
  );
}

export function ReportView({
  bundle,
  startAt,
  workspace,
}: {
  bundle: ReportBundle;
  startAt?: number;
  /** Inside the advertisement page: compact summary, grouped findings with review actions, no page-level CTAs. */
  workspace?: WorkspaceContext | null;
}) {
  const { t, tn, lang, formatDate } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { submission: sub, findings, run, transcript, rules } = bundle;
  const videoRef = useRef<HTMLVideoElement>(null);
  const issueRefs = useRef(new Map<string, HTMLElement>());
  const [time, setTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const currentVersion = useRulebook().data?.version?.version_label;
  const rerun = useMutation({
    mutationFn: () => rerunSubmission(sub.id),
    onSuccess: () => {
      toast.success(t("report.rerunDone"));
      void qc.invalidateQueries({ queryKey: qk.submission(sub.id) });
      void qc.invalidateQueries({ queryKey: qk.report(sub.id) });
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const issues = useMemo(
    () =>
      sortIssues(
        toIssueViews(findings, rules, lang, bundle.frameUrls, {
          rulesById: bundle.rulesById,
          sources: bundle.sources,
          previousVersionNo: sub.version_no ? sub.version_no - 1 : null,
        }),
      ),
    [findings, rules, lang, bundle.frameUrls, bundle.rulesById, bundle.sources, sub.version_no],
  );
  const { violations, warnings } = countBySeverity(findings);
  const status = sub.overall_status ?? "ready";
  const tone: Tone = status === "ready" ? "ready" : status === "review" ? "warning" : "violation";
  const isOwner = Boolean(user && sub.user_id === user.id && !sub.is_demo);

  const duration = useMemo(() => {
    const fromFindings = Math.max(0, ...findings.map((f) => Number(f.t_end ?? f.t_start ?? 0)));
    const fromTranscript = Math.max(0, ...transcript.map((s) => s.end));
    return Number(sub.duration_seconds) || Math.max(fromFindings, fromTranscript);
  }, [sub.duration_seconds, findings, transcript]);

  const seek = useCallback((tt: number) => {
    setTime(tt);
    if (videoRef.current) videoRef.current.currentTime = tt;
  }, []);
  // Opened from a finding link (?t=seconds): jump the player there once the media is ready.
  useEffect(() => {
    if (startAt == null) return;
    setTime(startAt);
    const v = videoRef.current;
    if (!v) return;
    if (v.readyState >= 1) {
      v.currentTime = startAt;
      return;
    }
    {
      const go = () => (v.currentTime = startAt);
      v.addEventListener("loadedmetadata", go, { once: true });
      return () => v.removeEventListener("loadedmetadata", go);
    }
  }, [startAt]);

  const selectIssue = useCallback(
    (id: string, scroll: boolean) => {
      setSelectedId(id);
      const issue = issues.find((i) => i.id === id);
      if (issue?.time != null) seek(issue.time);
      if (scroll)
        issueRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [issues, seek],
  );

  const del = useMutation({
    mutationFn: () => deleteMedia(sub.id),
    onSuccess: () => {
      toast.success(t("report.deleteMediaDone"));
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: qk.report(sub.id) });
    },
    onError: () => toast.error(t("errors.generic")),
  });

  const summary =
    status === "ready"
      ? t("report.summaryReady", { rules: tn("count.rules", rules.size) })
      : status === "review"
        ? t("report.summaryReview", { warnings: tn("count.warnings", warnings) })
        : warnings > 0
          ? t("report.summaryNeedsFixes", {
              violations: tn("count.violations", violations),
              warnings: tn("count.warnings", warnings),
            })
          : t("report.summaryNeedsFixesOnly", { violations: tn("count.violations", violations) });

  const model = [run?.llm_model, run?.asr_model].filter(Boolean).join(" · ");
  const audioMode =
    sub.kind === "video"
      ? (run?.audio_mode as "speech" | "music_no_speech" | "no_audio" | null)
      : null;
  const noSpeech = audioMode === "music_no_speech" || audioMode === "no_audio";
  const facts = [
    { label: t("report.factContent"), value: sub.title || t("dashboard.untitled") },
    { label: t("report.factPlatform"), value: t(`platforms.${sub.platform}`) },
    { label: t("report.factDate"), value: formatDate(sub.analyzed_at ?? sub.created_at) },
    { label: t("report.factRulebook"), value: bundle.rulebookVersion ?? "—", ltr: true },
    { label: t("report.factModel"), value: model || "—", ltr: true },
    ...(audioMode ? [{ label: t("audioMode.label"), value: t(`audioMode.${audioMode}`) }] : []),
  ];

  const primary =
    status === "ready" ? (
      <Button asChild>
        <Link to="/checks/$id/log" params={{ id: sub.id }}>
          <FileCheck2 aria-hidden="true" />
          {t("report.complianceLog")}
        </Link>
      </Button>
    ) : (
      <Button asChild>
        <Link to="/new" search={{ parent: sub.id }}>
          <Upload aria-hidden="true" />
          {t("report.uploadFixed")}
        </Link>
      </Button>
    );
  const secondary =
    status === "ready" ? (
      <Button asChild variant="secondary">
        <Link to="/new">
          <Plus aria-hidden="true" />
          {t("report.newCheck")}
        </Link>
      </Button>
    ) : (
      <Button asChild variant="secondary">
        <Link to="/checks/$id/log" params={{ id: sub.id }}>
          {t("report.complianceLog")}
        </Link>
      </Button>
    );
  const more = isOwner && (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton label={t("report.moreActions")} variant="secondary">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-60 rounded-md border border-border bg-surface p-1.5 shadow-overlay"
        >
          <DropdownMenu.Item
            onSelect={() => setShareOpen(true)}
            className={
              "flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
            }
          >
            <Share2 aria-hidden="true" className="size-4" />
            {t("report.share")}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => rerun.mutate()}
            className={
              "flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-sunken"
            }
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            {t("report.rerun")}
          </DropdownMenu.Item>
          {!sub.media_deleted_at && sub.file_path && (
            <DropdownMenu.Item
              onSelect={() => setConfirmDelete(true)}
              className="flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm text-red outline-none data-[highlighted]:bg-red-bg"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              {t("report.deleteMedia")}
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <Page
      wide={Boolean(workspace)}
      className={cn("flex flex-col gap-6 sm:gap-8", workspace && "pt-4 sm:pt-6")}
    >
      {sub.parent_id && (
        <Badge variant="outline" className="self-start">
          {t("report.recheckOf")}
          {bundle.parent?.title ? ` · ${bundle.parent.title}` : ""}
        </Badge>
      )}
      {workspace ? (
        <ResultSummary bundle={bundle} />
      ) : (
        <StatusBand
          tone={tone}
          title={`${t("report2.resultPrefix")} ${t(`status.${status}`)}`}
          summary={summary}
          facts={facts}
          actions={
            <>
              {primary}
              {secondary}
              {more}
            </>
          }
        />
      )}

      {!workspace && (
        <MobileActionBar>
          <div className="flex gap-2 [&>*]:flex-1">
            {primary}
            {secondary}
          </div>
        </MobileActionBar>
      )}

      {isOwner &&
        currentVersion &&
        bundle.rulebookVersion &&
        currentVersion !== bundle.rulebookVersion && (
          <p className="flex flex-wrap items-center gap-3 rounded-md border border-amber/25 bg-amber-bg px-4 py-3 text-sm">
            {t("report.rerunHint", { old: bundle.rulebookVersion, current: currentVersion })}
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw />}
              loading={rerun.isPending}
              onClick={() => rerun.mutate()}
            >
              {t("report.rerun")}
            </Button>
          </p>
        )}

      <CoverageBanner bundle={bundle} />

      {/* Re-check of a parent check (not a promotion version): its «what you fixed» panel stays useful. */}
      {status === "ready" && (!workspace || bundle.parent) && <ReadyComparison bundle={bundle} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <MediaPanel
            ref={videoRef}
            submission={sub}
            mediaUrl={bundle.mediaUrl}
            duration={duration}
            time={time}
            issues={issues}
            selectedId={selectedId}
            onTime={setTime}
            onSeek={seek}
            onSelectIssue={(id) => selectIssue(id, true)}
          />
          {sub.kind === "video" && (
            <TranscriptPanel
              segments={transcript}
              time={time}
              onSeek={seek}
              noSpeech={noSpeech}
              seekDisabled={!sub.is_demo && Boolean(sub.file_path) && !bundle.mediaUrl}
            />
          )}
        </div>

        <div className="flex flex-col gap-3">
          {noSpeech && (
            <p
              role="note"
              className="flex items-start gap-2 rounded-md border border-border bg-sunken px-4 py-3 text-sm text-fg"
            >
              <VolumeX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-muted" />
              {t("report.noSpeechNote")}
            </p>
          )}
          <FindingsWorkspace
            findings={findings}
            issues={issues}
            ws={workspace ?? null}
            selectedId={selectedId}
            onSelect={(id) => selectIssue(id, false)}
            submissionId={sub.id}
          />
          {sub.kind === "video" && selectedId && (
            <p className="sr-only" aria-live="polite">
              {formatClock(issues.find((i) => i.id === selectedId)?.time)}
            </p>
          )}
        </div>
      </div>

      <RegulatoryCoverageSection bundle={bundle} />

      <RuleOutcomes bundle={bundle} />

      <Disclaimer className="border-t border-border pt-5" />

      {isOwner && (
        <ShareDialog submissionId={sub.id} open={shareOpen} onOpenChange={setShareOpen} />
      )}

      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("report.deleteMediaTitle")}
        description={t("report.deleteMediaBody")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" loading={del.isPending} onClick={() => del.mutate()}>
              {t("common.delete")}
            </Button>
          </>
        }
      />
    </Page>
  );
}

/**
 * D217: the regulatory coverage of this analysis — every supported authority, considered automatically, for
 * individuals and organisations alike. Plain-language summary first, then one row per authority.
 */
function RegulatoryCoverageSection({ bundle }: { bundle: ReportBundle }) {
  const { t } = useI18n();
  const run =
    (bundle.run?.step_outputs as { authorities?: RunCoverage | null } | null | undefined)
      ?.authorities ?? null;
  return (
    <section
      aria-labelledby="reg-coverage"
      className="flex flex-col gap-3"
      data-testid="regulatory-coverage"
    >
      <div>
        <h2 id="reg-coverage" className="text-lg font-bold">
          {t("coverageRun.title")}
        </h2>
        <p className="text-sm text-fg-muted">{t("coverageRun.howItWorks")}</p>
      </div>
      <RunCoverageTable run={run} />
    </section>
  );
}
