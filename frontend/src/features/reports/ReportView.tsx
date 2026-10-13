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
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
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
import { qk } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { MediaPanel, TranscriptPanel } from "./MediaPanel";
import { countBySeverity, diffFindings, sortIssues, toIssueViews } from "./model";

type Tone = "violation" | "warning" | "ready";

export function Disclaimer({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={cn("flex items-start gap-2 text-sm text-fg-muted", className)}>
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>
        {t("brand.disclaimer")} {t("report.illustrativeNote")}
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
            <dd
              dir={f.ltr ? "ltr" : undefined}
              className="m-0 truncate text-sm font-medium text-fg rtl:text-end ltr:text-start"
            >
              {f.value}
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
              <div className="min-w-0 flex-1">
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
        className="group flex items-center gap-3 rounded-md border border-border bg-sunken px-4 py-3 hover:border-border-strong"
      >
        <div className="min-w-0 flex-1">
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

export function ReportView({ bundle }: { bundle: ReportBundle }) {
  const { t, tn, lang, formatDate } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { submission: sub, findings, run, transcript, rules } = bundle;
  const videoRef = useRef<HTMLVideoElement>(null);
  const issueRefs = useRef(new Map<string, HTMLElement>());
  const [time, setTime] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const issues = useMemo(
    () => sortIssues(toIssueViews(findings, rules, lang, bundle.frameUrls)),
    [findings, rules, lang, bundle.frameUrls],
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
  const facts = [
    { label: t("report.factContent"), value: sub.title || t("dashboard.untitled") },
    { label: t("report.factPlatform"), value: t(`platforms.${sub.platform}`) },
    { label: t("report.factDate"), value: formatDate(sub.analyzed_at ?? sub.created_at) },
    { label: t("report.factRulebook"), value: bundle.rulebookVersion ?? "—", ltr: true },
    { label: t("report.factModel"), value: model || "—", ltr: true },
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
  const more = isOwner && !sub.media_deleted_at && sub.file_path && (
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
          className="z-50 min-w-52 rounded-md border border-border bg-surface p-1.5 shadow-overlay"
        >
          <DropdownMenu.Item
            onSelect={() => setConfirmDelete(true)}
            className="flex h-11 cursor-pointer items-center gap-2.5 rounded-sm px-3 text-sm text-red outline-none data-[highlighted]:bg-red-bg"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t("report.deleteMedia")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <Page className="flex flex-col gap-6 sm:gap-8">
      {sub.parent_id && (
        <Badge variant="outline" className="self-start">
          {t("report.recheckOf")}
          {bundle.parent?.title ? ` · ${bundle.parent.title}` : ""}
        </Badge>
      )}
      <StatusBand
        tone={tone}
        title={t(`status.${status}`)}
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

      <MobileActionBar>
        <div className="flex gap-2 [&>*]:flex-1">
          {primary}
          {secondary}
        </div>
      </MobileActionBar>

      {status === "ready" && <ReadyComparison bundle={bundle} />}

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
            <TranscriptPanel segments={transcript} time={time} onSeek={seek} />
          )}
        </div>

        <section aria-labelledby="issues-heading" className="flex flex-col gap-3">
          <h2 id="issues-heading" className="flex items-baseline gap-2 text-xl font-bold">
            {t("report.issuesHeading")}
            <span className="tabular text-base font-medium text-fg-muted">({issues.length})</span>
          </h2>
          {issues.length === 0 ? (
            <Card className="flex items-center gap-3 text-fg">
              <CircleCheck aria-hidden="true" className="size-6 text-green" />
              {t("report.readyNoIssues")}
            </Card>
          ) : (
            issues.map((issue: IssueView) => (
              <div
                key={issue.id}
                ref={(el) =>
                  void (el
                    ? issueRefs.current.set(issue.id, el)
                    : issueRefs.current.delete(issue.id))
                }
                className="scroll-mt-24"
              >
                <IssueCard
                  issue={issue}
                  selected={selectedId === issue.id}
                  onSelect={() => selectIssue(issue.id, false)}
                />
              </div>
            ))
          )}
          {sub.kind === "video" && selectedId && (
            <p className="sr-only" aria-live="polite">
              {formatClock(issues.find((i) => i.id === selectedId)?.time)}
            </p>
          )}
        </section>
      </div>

      <Disclaimer className="border-t border-border pt-5" />

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
