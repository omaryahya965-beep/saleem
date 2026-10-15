import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  MessageSquareQuote,
  Tag,
  Wrench,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { formatClock, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { Dialog } from "./Overlays";
import { Badge, StatusChip } from "./Status";

export type Severity = "violation" | "warning";
export type EvidenceType = "transcript" | "frame" | "caption" | "metadata";

export interface IssueView {
  id: string;
  severity: Severity;
  /** Seconds, or null for whole-clip / metadata issues. */
  time: number | null;
  title: string;
  ruleCode: string;
  ruleTitle: string;
  sourceName: string;
  sourceUrl: string | null;
  evidenceType: EvidenceType;
  evidence: string | null;
  /** Signed URL of the evidence frame; always a server-side blurred copy (privacy). */
  frameUrl?: string | null;
  fix: string;
}

interface IssueCardProps {
  issue: IssueView;
  selected?: boolean;
  /** Called when the card (time button) is activated — seek the player. */
  onSelect?: () => void;
  className?: string;
}

const evidenceIcon: Record<EvidenceType, ReactNode> = {
  transcript: <MessageSquareQuote aria-hidden="true" />,
  frame: <ImageIcon aria-hidden="true" />,
  caption: <FileText aria-hidden="true" />,
  metadata: <Tag aria-hidden="true" />,
};

/**
 * IssueCard — one finding: time, severity chip, title, rule + official source, evidence, fix.
 * The header is the interactive element (no nested interactives); the source link is separate.
 */
export function IssueCard({ issue, selected, onSelect, className }: IssueCardProps) {
  const { t } = useI18n();
  const [frameOpen, setFrameOpen] = useState(false);
  const hasTime = issue.time !== null;
  const frameAlt = t("issue.evidenceFrame", { time: formatClock(issue.time) });
  return (
    <article
      aria-current={selected || undefined}
      className={cn(
        "relative rounded-lg border bg-surface transition-[border-color,box-shadow] duration-200",
        selected ? "border-ink shadow-raised" : "border-border",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-4 start-0 w-1 rounded-e-full",
          issue.severity === "violation" ? "bg-red" : "bg-amber",
        )}
      />
      <button
        type="button"
        onClick={onSelect}
        aria-label={
          hasTime
            ? t("issue.seek", { time: formatClock(issue.time) }) + " — " + issue.title
            : issue.title
        }
        className="flex w-full items-start gap-3 rounded-t-lg p-4 pb-2 text-start sm:p-5 sm:pb-2"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip tone={issue.severity} size="sm">
              {t(`severity.${issue.severity}`)}
            </StatusChip>
            <span
              className={cn("tabular text-sm font-bold", hasTime ? "text-fg" : "text-fg-muted")}
            >
              {hasTime ? formatClock(issue.time) : t("issue.noTime")}
            </span>
          </span>
          <span className="text-lg leading-snug font-bold text-fg">{issue.title}</span>
        </span>
      </button>
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          <Badge mono>{issue.ruleCode}</Badge>
          <span className="text-fg">{issue.ruleTitle}</span>
          {issue.sourceUrl ? (
            <a
              href={issue.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-6 items-center gap-1 text-green underline-offset-4 hover:underline"
            >
              {issue.sourceName}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : (
            <span>{issue.sourceName}</span>
          )}
        </p>
        {(issue.evidence || issue.frameUrl) && (
          <div className="flex items-start gap-3 rounded-md bg-sunken p-3 text-sm">
            {issue.frameUrl ? (
              <>
                {/* Click to enlarge: the thumbnail is too small to read the evidence. */}
                <button
                  type="button"
                  onClick={() => setFrameOpen(true)}
                  aria-label={t("issue.enlargeFrame")}
                  className="shrink-0 cursor-zoom-in rounded-sm transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <img src={issue.frameUrl} alt={frameAlt} className="h-16 w-12 rounded-sm object-cover" />
                </button>
                <Dialog
                  open={frameOpen}
                  onOpenChange={setFrameOpen}
                  title={frameAlt}
                  description={issue.evidence ?? undefined}
                  className="sm:max-w-2xl"
                >
                  <img
                    src={issue.frameUrl}
                    alt={frameAlt}
                    className="mx-auto mb-4 max-h-[70dvh] w-auto rounded-md object-contain"
                  />
                </Dialog>
              </>
            ) : (
              <span className="mt-0.5 text-fg-muted [&_svg]:size-4">
                {evidenceIcon[issue.evidenceType]}
              </span>
            )}
            <div className="min-w-0">
              <span className="block text-xs font-medium text-fg-muted">
                {issue.evidenceType === "metadata"
                  ? t("issue.evidenceMetadata")
                  : issue.evidenceType === "caption"
                    ? t("issue.evidenceCaption")
                    : t("issue.evidence")}
              </span>
              {issue.evidence && (
                <q dir="auto" className="block text-fg [quotes:none]">
                  {issue.evidence}
                </q>
              )}
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 rounded-md border border-green/20 bg-green-bg/60 p-3 text-sm">
          <Wrench aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green" />
          <p>
            <span className="font-bold text-ready">{t("issue.fix")}: </span>
            <span className="text-fg">{issue.fix}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

/** RuleRow — one rulebook entry: code, title, source, version, default severity. */
export function RuleRow({
  code,
  title,
  description,
  sourceName,
  sourceUrl,
  version,
  severity,
  illustrative,
  illustrativeLabel,
}: {
  code: string;
  title: string;
  description?: string;
  sourceName: string;
  sourceUrl: string | null;
  version?: string;
  severity: Severity;
  illustrative?: boolean;
  illustrativeLabel?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-x-4 gap-y-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[88px_1fr_auto] sm:items-start">
      <div>
        <Badge mono>{code}</Badge>
      </div>
      <div className="min-w-0">
        <p className="font-bold text-fg">{title}</p>
        {description && <p className="prose-measure mt-0.5 text-sm text-fg-muted">{description}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-6 items-center gap-1 text-green underline-offset-4 hover:underline"
            >
              {sourceName}
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          ) : (
            <span>{sourceName}</span>
          )}
          {version && <span className="tabular">v{version}</span>}
          {illustrative && <Badge variant="outline">{illustrativeLabel}</Badge>}
        </p>
      </div>
      <div className="sm:justify-self-end">
        <StatusChip tone={severity} size="sm">
          {t(`severity.${severity}`)}
        </StatusChip>
      </div>
    </div>
  );
}
