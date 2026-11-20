// Automated-analysis findings as one review workspace (V2 upgrade §9–§10, D176): grouped findings, the marketer's
// answers and the reviewer's assessments inside the same card, filters with counts, progress and a jump to the next
// unanswered finding. Every action goes through respond_finding (server-side permissions, idempotent repeats).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  CircleCheck,
  ExternalLink,
  FileText,
  Film,
  History,
  Image as ImageIcon,
  ListChecks,
  MessageSquare,
  Tag,
  Wrench,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, StatusChip, Textarea, toast, type IssueView } from "@/components/ui";
import { formatClock, useI18n, type TKey } from "@/i18n";
import type { Finding } from "@/lib/api/data";
import { qk } from "@/lib/api/hooks";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import {
  COMMENT_REQUIRED,
  REVIEWER_ACTIONS,
  UPLOADER_ACTIONS,
  respondFinding,
  rk,
  useResponses,
  type FindingResponse,
  type ResponseAction,
} from "@/lib/api/review";
import { cn } from "@/lib/utils";
import {
  groupFindings,
  groupStatus,
  matchesFilter,
  type FindingGroup,
  type ReviewFilter,
} from "@/features/reports/grouping";
import { usePreflightText } from "./model";

export interface WorkspaceContext {
  promotion: Promotion;
  version: VersionSummary;
  isLatest: boolean;
  orgRole: string | null;
  userId: string | null;
  isOwner: boolean;
}

const UPLOADER_STATUSES = new Set([
  "draft",
  "changes_requested",
  "rejected",
  "conditionally_approved",
  "pending_review",
  "in_review",
]);
const REVIEWER_STATUSES = new Set(["in_review", "escalated", "conditionally_approved"]);
const FILTERS: ReviewFilter[] = [
  "all",
  "violations",
  "warnings",
  "unanswered",
  "needs_correction",
  "needs_evidence",
  "confirmed",
  "not_applicable",
  "resolved",
];

/** Which side the caller answers on — mirrors respond_finding (the server decides). */
export function responderSide(ws: WorkspaceContext): "uploader" | "reviewer" | null {
  const p = ws.promotion;
  if (!ws.isLatest || p.is_demo || !p.org_id) return null;
  const role = ws.orgRole ?? "";
  const uploadedIt = Boolean(ws.userId && ws.version.user_id === ws.userId);
  const reviewer =
    ["owner", "admin", "reviewer", "compliance_lead"].includes(role) &&
    !uploadedIt &&
    (role !== "reviewer" || p.assigned_reviewer_id === ws.userId) &&
    REVIEWER_STATUSES.has(p.review_status);
  if (reviewer) return "reviewer";
  const uploader =
    (ws.isOwner || uploadedIt || ["owner", "admin", "creator"].includes(role)) &&
    UPLOADER_STATUSES.has(p.review_status);
  return uploader ? "uploader" : null;
}

type GroupF = Finding & { status?: string | null };

export function FindingsWorkspace({
  findings,
  issues,
  ws,
  selectedId,
  onSelect,
  submissionId,
}: {
  findings: Finding[];
  issues: IssueView[];
  ws: WorkspaceContext | null;
  selectedId: string | null;
  onSelect: (issueId: string) => void;
  submissionId: string;
}) {
  const { t } = useI18n();
  const responses = useResponses(ws && ws.promotion.org_id ? ws.version.id : null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const refs = useRef(new Map<string, HTMLElement>());
  const groups = useMemo(() => groupFindings(findings as GroupF[]), [findings]);
  const byId = useMemo(() => new Map(issues.map((i) => [i.id, i])), [issues]);
  const side = ws ? responderSide(ws) : null;
  const history = responses.data ?? [];
  const reviewed = (g: FindingGroup) =>
    g.members.every((m) =>
      history.some((r) => r.finding_id === m.id && r.actor_role === "reviewer"),
    );
  const answeredByUploader = (g: FindingGroup) =>
    g.members.every(
      (m) =>
        history.some((r) => r.finding_id === m.id && r.actor_role === "uploader") ||
        (m.status ?? "open") !== "open",
    );
  const answered = side === "uploader" ? answeredByUploader : reviewed;
  const visible = groups.filter((g) => matchesFilter(g, filter, answered));
  const done = groups.filter(answered).length;
  const nextUnanswered = groups.find((g) => !answered(g));

  if (groups.length === 0)
    return (
      <Card className="flex items-center gap-3 text-fg">
        <CircleCheck aria-hidden="true" className="size-6 text-green" />
        {t("report.readyNoIssues")}
      </Card>
    );

  return (
    <section
      aria-labelledby="ws-findings"
      className="flex flex-col gap-3"
      data-testid="findings-workspace"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ws-findings" className="flex items-baseline gap-2 text-xl font-bold">
          {t("ws.findings.title")}
          <span className="tabular text-base font-medium text-fg-muted">
            {t("ws.findings.counts", { groups: groups.length, raw: findings.length })}
          </span>
        </h2>
        {ws?.promotion.org_id && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1" data-testid="review-progress">
              <span className="text-sm font-medium">
                {t(
                  side === "uploader"
                    ? "ws.findings.progressAnswered"
                    : "ws.findings.progressReviewed",
                  {
                    done,
                    total: groups.length,
                  },
                )}
              </span>
              <span
                className="h-1.5 w-40 overflow-hidden rounded-full bg-sunken"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={groups.length}
                aria-valuenow={done}
              >
                <span
                  className="block h-full rounded-full bg-green transition-[width]"
                  style={{ width: `${(done / groups.length) * 100}%` }}
                />
              </span>
            </div>
            {side && nextUnanswered && (
              <Button
                size="sm"
                variant="secondary"
                icon={<ListChecks />}
                onClick={() => {
                  setFilter("all");
                  requestAnimationFrame(() =>
                    refs.current
                      .get(nextUnanswered.key)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  );
                }}
              >
                {t("ws.findings.nextUnanswered")}
              </Button>
            )}
          </div>
        )}
      </div>

      <div role="toolbar" aria-label={t("ws.findings.filters")} className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const n = groups.filter((g) => matchesFilter(g, f, answered)).length;
          if (n === 0 && f !== "all" && f !== filter) return null;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                filter === f
                  ? "border-ink bg-ink text-white"
                  : "border-border bg-surface text-fg hover:bg-sunken",
              )}
            >
              {t(`ws.filter.${f}` as TKey)}
              <span className="tabular text-xs opacity-75">{n}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-fg-muted">
          {t("ws.findings.noneForFilter")}
        </p>
      ) : (
        visible.map((g) => (
          <div
            key={g.key}
            ref={(el) => void (el ? refs.current.set(g.key, el) : refs.current.delete(g.key))}
            className="scroll-mt-24"
          >
            <GroupCard
              group={g}
              issues={g.members.map((m) => byId.get(m.id)).filter(Boolean) as IssueView[]}
              history={history.filter((r) => g.members.some((m) => m.id === r.finding_id))}
              side={side}
              ws={ws}
              selected={g.members.some((m) => m.id === selectedId)}
              onSelect={onSelect}
              submissionId={submissionId}
            />
          </div>
        ))
      )}
      <p className="text-xs text-fg-muted">{t("ws.findings.advisory")}</p>
    </section>
  );
}

const sourceIcon: Record<string, React.ReactNode> = {
  transcript: <MessageSquare aria-hidden="true" />,
  frame: <ImageIcon aria-hidden="true" />,
  caption: <FileText aria-hidden="true" />,
  metadata: <Tag aria-hidden="true" />,
};

function GroupCard({
  group: g,
  issues,
  history,
  side,
  ws,
  selected,
  onSelect,
  submissionId,
}: {
  group: FindingGroup;
  issues: IssueView[];
  history: FindingResponse[];
  side: "uploader" | "reviewer" | null;
  ws: WorkspaceContext | null;
  selected: boolean;
  onSelect: (id: string) => void;
  submissionId: string;
}) {
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const [open, setOpen] = useState(g.severity === "violation");
  const [action, setAction] = useState<ResponseAction | null>(null);
  const [comment, setComment] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const lead = issues[0];
  const status = groupStatus(g);
  const lastReviewer = [...history].reverse().find((r) => r.actor_role === "reviewer");
  const lastUploader = [...history].reverse().find((r) => r.actor_role === "uploader");
  const confirmedByHuman =
    lastReviewer &&
    [
      "agree_please_action",
      "evidence_required",
      "clarification_required",
      "correction_verified",
    ].includes(lastReviewer.action);
  const respond = useMutation({
    mutationFn: async (v: { action: ResponseAction; comment: string }) => {
      // One answer for the claim = the same answer on every raw finding of the group (each idempotent).
      for (const m of g.members) await respondFinding(m.id, v.action, v.comment);
    },
    onSuccess: () => {
      setSavedAt(new Date());
      setAction(null);
      setComment("");
      toast.success(t("review.responses.respondedToast"));
      if (ws) {
        void qc.invalidateQueries({ queryKey: rk.responses(ws.version.id) });
        void qc.invalidateQueries({ queryKey: ["can-submit", ws.promotion.id] });
        void qc.invalidateQueries({ queryKey: ["can-decide", ws.promotion.id] });
      }
      void qc.invalidateQueries({ queryKey: qk.report(submissionId) });
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!lead) return null;
  const actions =
    side === "reviewer" ? REVIEWER_ACTIONS : side === "uploader" ? UPLOADER_ACTIONS : [];
  const pick = (a: ResponseAction) =>
    COMMENT_REQUIRED.has(a) ? setAction(a) : respond.mutate({ action: a, comment: "" });
  const latest = lastReviewer ?? lastUploader;

  return (
    <article
      aria-current={selected || undefined}
      data-testid="finding-group"
      className={cn(
        "relative rounded-lg border bg-surface",
        selected ? "border-ink shadow-raised" : "border-border",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-4 start-0 w-1 rounded-e-full",
          g.severity === "violation" ? "bg-red" : "bg-amber",
        )}
      />
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-start gap-3 p-4 pb-2 text-start sm:p-5 sm:pb-2"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip tone={g.severity} size="sm">
              {t(`severity.${g.severity}`)}
            </StatusChip>
            <Badge>{t(`ws.status.${status}` as TKey)}</Badge>
            {g.members.length > 1 && (
              <Badge variant="outline">
                {t("ws.findings.occurrences", { n: g.members.length })}
              </Badge>
            )}
            {confirmedByHuman ? (
              <Badge variant="outline">{t("ws.kind.human")}</Badge>
            ) : (
              <Badge variant="neutral">{t("ws.kind.automated")}</Badge>
            )}
            {lead.v2?.internalPolicy && (
              <Badge variant="outline">{t("findingType.internal_policy")}</Badge>
            )}
            {lead.v2?.draftRule && (
              <Badge variant="neutral">{t("ws.kind.legalConfirmation")}</Badge>
            )}
            {lead.v2?.findingType &&
              ["missing_required", "needs_evidence"].includes(lead.v2.findingType) && (
                <Badge variant="neutral">{t("ws.kind.missingEvidence")}</Badge>
              )}
          </span>
          <span className="text-lg leading-snug font-bold text-fg">{lead.title}</span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <Badge mono className="font-semibold">
              {g.ruleCode}
            </Badge>
            <span className="text-fg">{lead.ruleTitle}</span>
            <span className="inline-flex items-center gap-1 [&_svg]:size-3.5">
              {g.sources.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-sm bg-sunken px-1.5 py-0.5 text-xs"
                >
                  {sourceIcon[s] ?? <Film aria-hidden="true" />}
                  {t(`ws.source.${s}` as TKey)}
                </span>
              ))}
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "mt-1 size-5 shrink-0 text-fg-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
        {g.members.some((m) => m.t_start !== null) && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            aria-label={t("ws.findings.timestamps")}
          >
            {g.members
              .filter((m) => m.t_start !== null)
              .map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className="tabular inline-flex min-h-8 items-center rounded-full border border-border px-2.5 text-sm font-bold hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent"
                  aria-label={t("issue.seek", { time: formatClock(Number(m.t_start)) })}
                >
                  {formatClock(Number(m.t_start))}
                </button>
              ))}
          </div>
        )}
        {!open && latest && (
          <p className="text-sm text-fg-muted">
            {t(`ws.response.${latest.action}` as TKey)}
            {latest.comment ? ` — ${latest.comment}` : ""}
          </p>
        )}
        {open && (
          <>
            <ul className="flex flex-col gap-2" aria-label={t("ws.findings.evidence")}>
              {issues.map((i) => (
                <li key={i.id} className="flex items-start gap-3 rounded-md bg-sunken p-3 text-sm">
                  {i.frameUrl ? (
                    <img
                      src={i.frameUrl}
                      alt={t("issue.evidenceFrame", { time: formatClock(i.time) })}
                      className="h-16 w-12 shrink-0 rounded-sm object-cover"
                    />
                  ) : (
                    <span className="mt-0.5 text-fg-muted [&_svg]:size-4">
                      {sourceIcon[i.evidenceType] ?? null}
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-fg-muted">
                      {t(`ws.source.${i.evidenceType}` as TKey)}
                      {i.time !== null ? ` · ${formatClock(i.time)}` : ""}
                    </span>
                    {i.evidence && (
                      <q dir="auto" className="block text-fg [quotes:none]">
                        {i.evidence}
                      </q>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted"
              data-testid="citation"
            >
              {lead.sourceName && <span>{lead.sourceName}</span>}
              {lead.v2?.articleRef && (
                <span>
                  {t("findingType.article")} <bdi>{lead.v2.articleRef}</bdi>
                </span>
              )}
              {lead.v2?.verification && (
                <Badge>{t(`findingType.verification.${lead.v2.verification}` as TKey)}</Badge>
              )}
              <Link
                to="/rules"
                search={{ q: g.ruleCode }}
                className="text-green underline-offset-4 hover:underline"
              >
                {t("ws.findings.ruleDetails")}
              </Link>
              {lead.sourceUrl && (
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {t("ws.findings.officialSource")}
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              )}
            </div>
            {lead.v2?.evidenceRequest && (
              <p className="text-sm">
                <span className="font-bold">{t("findingType.evidenceRequest")}: </span>
                {lead.v2.evidenceRequest}
              </p>
            )}
            {lead.fix && (
              <div className="flex items-start gap-3 rounded-md border border-green/20 bg-green-bg/60 p-3 text-sm">
                <Wrench aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green" />
                <p>
                  <span className="font-bold text-ready">{t("issue.fix")}: </span>
                  {lead.fix}
                </p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <ResponseSummary label={t("ws.findings.marketerResponse")} r={lastUploader} />
              <ResponseSummary label={t("ws.findings.reviewerAssessment")} r={lastReviewer} />
            </div>
          </>
        )}

        {actions.length > 0 && (
          <div
            className="flex flex-col gap-2 border-t border-border pt-3"
            data-testid="finding-actions"
          >
            <div className="flex flex-wrap gap-1.5">
              {actions.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={action === a ? "primary" : "secondary"}
                  disabled={respond.isPending}
                  aria-pressed={action === a}
                  onClick={() => pick(a)}
                >
                  {t(`ws.action.${a}` as TKey)}
                </Button>
              ))}
            </div>
            {action && (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) respond.mutate({ action, comment });
                }}
              >
                <label className="text-sm font-medium" htmlFor={`c-${g.key}`}>
                  {t("ws.findings.explanationRequired")}
                </label>
                <Textarea
                  id={`c-${g.key}`}
                  rows={2}
                  value={comment}
                  maxLength={2000}
                  onChange={(e) => setComment(e.target.value)}
                  dir="auto"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    loading={respond.isPending}
                    disabled={!comment.trim()}
                  >
                    {t("ws.findings.saveResponse")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setAction(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            )}
            {savedAt && (
              <p role="status" className="inline-flex items-center gap-1 text-xs text-green">
                <Check aria-hidden="true" className="size-3.5" />
                {t("ws.findings.saved", { time: formatDate(savedAt.toISOString()) })}
              </p>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={showHistory}
              onClick={() => setShowHistory((x) => !x)}
              className="inline-flex items-center gap-1.5 text-xs text-fg-muted underline-offset-4 hover:underline"
            >
              <History aria-hidden="true" className="size-3.5" />
              {t("ws.findings.history", { n: history.length })}
            </button>
            {showHistory && (
              <ol className="mt-2 flex flex-col gap-1.5 border-s-2 border-border ps-3 text-xs">
                {history.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{t(`ws.side.${r.actor_role}` as TKey)}</span> ·{" "}
                    {t(`ws.response.${r.action}` as TKey)} ·{" "}
                    <span className="text-fg-muted">{formatDate(r.created_at)}</span>
                    {r.comment && (
                      <span dir="auto" className="block text-fg">
                        {r.comment}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ResponseSummary({ label, r }: { label: string; r: FindingResponse | undefined }) {
  const { t } = useI18n();
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      {r ? (
        <>
          <p className="font-medium">{t(`ws.response.${r.action}` as TKey)}</p>
          {r.comment && (
            <p dir="auto" className="mt-0.5 text-fg">
              {r.comment}
            </p>
          )}
        </>
      ) : (
        <p className="text-fg-muted">{t("ws.findings.noResponse")}</p>
      )}
    </div>
  );
}
