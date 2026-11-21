// Advertisement review workspace (V2 upgrade §8, D177). One page per advertisement: a header that separates the
// automated analysis state from the human approval state (live, so a finished analysis never keeps showing
// «جارٍ التحليل»), the selected version with a clear historical-snapshot guard, the role's next step, the latest
// decision with its correction checklist, structured conditions, and five tabs that do not repeat each other.
import { Link, useNavigate } from "@tanstack/react-router";
import { ApiErrorState } from "@/components/feedback/ApiErrorState";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  FileQuestion,
  History as HistoryIcon,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Page,
  Skeleton,
  StatusChip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  type StatusTone,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { useAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/data";
import { fetchMyMemberships, rerunSubmission } from "@/lib/api/features";
import { useReport, useSubmissionStatus } from "@/lib/api/hooks";
import { coverageOf } from "@/features/reports/RuleOutcomes";
import {
  OPEN_STATUSES,
  dbErrorCode,
  pk,
  updatePromotionContext,
  usePromotion,
  useProducts,
  type Promotion,
  type PromotionBundle,
  type VersionSummary,
} from "@/lib/api/promotions";
import { fetchHistory, fetchReasons, rk, type ReviewDecision } from "@/lib/api/review";
import { CheckPage } from "@/features/reports/CheckPage";
import { ContextFields, type ContextValue } from "./ContextFields";
import { pickVersion } from "./model";
import { DeclarationsSection, ProductCampaignSections, WorkflowSection } from "./InfoSections";
import { ReviewActions } from "@/features/review/ReviewActions";
import { ConditionsPanel } from "@/features/review/ConditionsPanel";
import { HistoryPanel } from "@/features/review/HistoryPanel";
import { CommentsPanel } from "@/features/collab/CommentsPanel";
import { CompareTab } from "@/features/collab/CompareTab";
import { LinkedClaims } from "@/features/libraries/LinkedClaims";
import { VariationsCard } from "@/features/enterprise/VariationsCard";
import { LifecyclePanel } from "@/features/enterprise/LifecyclePanel";
import { ReadabilityPanel } from "@/features/enterprise/ReadabilityPanel";
import { cn } from "@/lib/utils";

export function PromotionPage({ id, v, t: startAt }: { id: string; v?: number; t?: number }) {
  const { t } = useI18n();
  const promo = usePromotion(id);
  if (promo.isPending)
    return (
      <Page wide className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </Page>
    );
  if (promo.isError) {
    if (promo.error instanceof ApiError && promo.error.code === "not_found")
      return (
        <Page narrow>
          <EmptyState
            icon={<FileQuestion />}
            title={t("promo.notFoundTitle")}
            body={t("promo.notFoundBody")}
            action={
              <Button asChild>
                <Link to="/promotions">{t("nav.promotions")}</Link>
              </Button>
            }
          />
        </Page>
      );
    return (
      <Page narrow>
        <ApiErrorState
          title={t("promo.notFoundTitle")}
          error={promo.error}
          onRetry={() => void promo.refetch()}
        />
      </Page>
    );
  }
  return <PromotionView bundle={promo.data} v={v} startAt={startAt} />;
}

/** Automated analysis state of a version, independent of the human review state (§6). */
export type AnalysisState =
  | "not_started"
  | "queued"
  | "extracting"
  | "transcribing"
  | "analyzing"
  | "done"
  | "partial"
  | "failed";
export function analysisState(
  status: string | null | undefined,
  coveragePartial = false,
): AnalysisState {
  if (!status) return "not_started";
  if (status === "done") return coveragePartial ? "partial" : "done";
  if (["queued", "extracting", "transcribing", "analyzing", "failed"].includes(status))
    return status as AnalysisState;
  return "analyzing";
}
const analysisTone: Record<AnalysisState, StatusTone> = {
  not_started: "neutral",
  queued: "processing",
  extracting: "processing",
  transcribing: "processing",
  analyzing: "processing",
  done: "ready",
  partial: "warning",
  failed: "violation",
};
const reviewTone = (s: string): StatusTone =>
  s === "approved"
    ? "ready"
    : ["rejected", "changes_requested"].includes(s)
      ? "violation"
      : ["conditionally_approved", "escalated", "reviewing_risk", "due_for_rereview"].includes(s)
        ? "warning"
        : ["pending_review", "in_review"].includes(s)
          ? "processing"
          : "neutral";

function useRole(orgId: string | null) {
  const { user } = useAuth();
  // Own memberships are readable by every role, external partners included (organisations are not).
  const m = useQuery({
    queryKey: ["my-memberships", user?.id],
    queryFn: fetchMyMemberships,
    enabled: Boolean(user),
  });
  return m.data?.find((x) => x.org_id === orgId)?.role ?? null;
}

function PromotionView({
  bundle,
  v,
  startAt,
}: {
  bundle: PromotionBundle;
  v?: number;
  startAt?: number;
}) {
  const { t, lang, formatDate } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { promotion: p, versions, product } = bundle;
  const { version, missing } = pickVersion(versions, v);
  const latest = versions.at(-1) ?? null;
  const isLatest = Boolean(version && latest && version.id === latest.id);
  const role = useRole(p.org_id);
  const isOwner = Boolean(user && p.owner_id === user.id);
  const open = OPEN_STATUSES.has(p.review_status);
  const canUpload =
    !p.is_demo &&
    (isOwner || ["owner", "admin", "creator"].includes(role ?? "")) &&
    role !== "reviewer";
  const canEdit = !p.is_demo && open && (isOwner || role === "owner" || role === "admin");
  const [tab, setTab] = useState("analysis");

  // Live analysis state of the latest version: polls until terminal, then refreshes the bundle once.
  const live = useSubmissionStatus(latest?.id ?? "");
  const liveStatus = live.data?.status ?? latest?.status;
  useEffect(() => {
    if (live.data && latest && live.data.status !== latest.status) {
      void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
      void qc.invalidateQueries({ queryKey: ["promotions"] });
    }
  }, [live.data, latest, qc, p.id]);
  // Done but some applicable rules could not be evaluated → «اكتمل جزئياً» (same cached report as the tab).
  const shownStatus = isLatest ? liveStatus : version?.status;
  const report = useReport(version?.id ?? "", Boolean(version?.id) && shownStatus === "done");
  const aState = analysisState(
    shownStatus,
    report.data ? coverageOf(report.data)?.status === "partial" : false,
  );
  const statusLabel = t(`promo.reviewStatus.${p.review_status}` as TKey);
  // «غير مُسند» only for the reviewer slot; an unknown creator is «—».
  const person = (id: string | null | undefined, empty = t("ws.header.unassigned")) =>
    id ? (bundle.people?.[id]?.name ?? t("ws.header.unknownPerson")) : empty;
  const overdue = Boolean(
    p.deadline_at &&
    new Date(p.deadline_at) < new Date() &&
    !["approved", "rejected", "archived", "withdrawn"].includes(p.review_status),
  );
  const me = { userId: user?.id ?? null, orgRole: role, isOwner };

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <Page wide className="flex flex-col gap-4 pb-0 sm:pb-0">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold break-words sm:text-3xl" dir="auto">
                {p.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span data-testid="review-status" className="inline-flex items-center gap-1.5">
                  <span className="text-xs text-fg-muted">{t("ws.header.humanStatus")}</span>
                  <StatusChip tone={reviewTone(p.review_status)} size="sm">
                    {statusLabel}
                  </StatusChip>
                </span>
                <span data-testid="analysis-status" className="inline-flex items-center gap-1.5">
                  <span className="text-xs text-fg-muted">{t("ws.header.analysisStatus")}</span>
                  <StatusChip tone={analysisTone[aState]} size="sm">
                    {t(`ws.analysis.${aState}` as TKey)}
                  </StatusChip>
                </span>
                {p.is_demo && <Badge variant="neutral">{t("common.demo")}</Badge>}
                {overdue && (
                  <Badge variant="outline" className="text-red">
                    {t("ws.header.overdue")}
                  </Badge>
                )}
              </div>
            </div>
            {canUpload && isLatest && (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {open ? (
                  <>
                    <Button asChild icon={<Upload />}>
                      <Link to="/new" search={{ promotion: p.id }}>
                        {t("ws.header.uploadRevision")}
                      </Link>
                    </Button>
                    {latest?.status === "done" && (
                      <Button asChild variant="secondary" icon={<Sparkles />}>
                        <Link to="/promotions/$id/fix" params={{ id: p.id }}>
                          {t("ws.header.openFix")}
                        </Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-fg-muted">
                    {t("promo.lockedHint", { status: statusLabel })}
                  </p>
                )}
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 xl:grid-cols-6">
            <Meta label={t("ws.header.product")}>
              {product
                ? (lang === "en" && product.name_en) || product.name_ar
                : t("promo.noProduct")}
            </Meta>
            <Meta label={t("ws.header.campaign")}>{bundle.campaign?.name ?? t("common.none")}</Meta>
            <Meta label={t("ws.header.creator")}>{person(latest?.user_id ?? p.owner_id, "—")}</Meta>
            <Meta label={t("ws.header.assignee")}>{person(p.assigned_reviewer_id)}</Meta>
            <Meta label={t("ws.header.deadline")}>
              {p.deadline_at ? (
                <span className={cn("inline-flex items-center gap-1", overdue && "text-red")}>
                  <CalendarClock aria-hidden="true" className="size-3.5" />
                  {formatDate(p.deadline_at)}
                </span>
              ) : (
                t("common.none")
              )}
            </Meta>
            <Meta label={t("ws.header.submitted")}>
              {p.submitted_at ? formatDate(p.submitted_at) : t("common.none")}
            </Meta>
          </dl>

          {versions.length > 0 && (
            <nav aria-label={t("promo.versions")} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-muted">{t("promo.versions")}:</span>
              {versions.map((x) => {
                const active = x.id === version?.id;
                return (
                  <Button
                    key={x.id}
                    size="sm"
                    variant={active ? "primary" : "secondary"}
                    aria-current={active ? "page" : undefined}
                    onClick={() =>
                      void navigate({
                        to: "/promotions/$id",
                        params: { id: p.id },
                        search: { v: x.version_no ?? undefined },
                      })
                    }
                  >
                    <bdi>{t("ws.header.version", { n: x.version_no ?? 0 })}</bdi>
                    {x === latest && versions.length > 1 ? ` · ${t("promo.latest")}` : ""}
                    {p.approved_version_id === x.id ? " ✓" : ""}
                  </Button>
                );
              })}
            </nav>
          )}
          {!isLatest && version && (
            <div
              role="status"
              data-testid="historical-version"
              className="flex flex-col gap-2 rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="flex items-center gap-2">
                <HistoryIcon aria-hidden="true" className="size-4 shrink-0" />
                {t("ws.header.historical", { n: version.version_no ?? 0 })}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void navigate({ to: "/promotions/$id", params: { id: p.id } })}
              >
                {t("ws.header.viewLatest")}
              </Button>
            </div>
          )}
          {missing && (
            <p role="status" className="text-sm text-amber-text">
              {t("promo.versionNotFound")}
            </p>
          )}
        </header>

        {isLatest && (
          <NextStep
            promotion={p}
            latest={latest}
            analysis={aState}
            me={me}
            canUpload={canUpload}
            onTab={setTab}
          />
        )}
        {isLatest && (
          <DecisionSummary
            promotion={p}
            versions={versions}
            people={bundle.people}
            canUpload={canUpload && open}
          />
        )}
        {isLatest && p.org_id && (
          <ConditionsPanel
            promotion={p}
            orgRole={role}
            userId={user?.id ?? null}
            isOwner={isOwner}
            uploaderId={latest?.user_id ?? null}
            people={bundle.people}
          />
        )}

        <TabsList label={t("promo.versions")}>
          <TabsTrigger value="analysis">{t("ws.tab.analysis")}</TabsTrigger>
          <TabsTrigger value="info">{t("ws.tab.info")}</TabsTrigger>
          <TabsTrigger value="comments">{t("ws.tab.comments")}</TabsTrigger>
          <TabsTrigger value="compare">{t("ws.tab.compare")}</TabsTrigger>
          <TabsTrigger value="history">{t("ws.tab.history")}</TabsTrigger>
        </TabsList>
      </Page>

      <TabsContent value="analysis">
        {version ? (
          <CheckPage
            key={version.id}
            id={version.id}
            startAt={startAt}
            workspace={{
              promotion: p,
              version,
              isLatest,
              orgRole: role,
              userId: user?.id ?? null,
              isOwner,
            }}
          />
        ) : (
          <Page wide>
            <EmptyState
              icon={<Upload />}
              title={t("ws.next.marketer.start_analysis")}
              body={t("ws.analysis.not_started")}
            />
          </Page>
        )}
        {result(version) && (
          <Page wide className="pt-0 sm:pt-0">
            <p className="text-sm text-fg-muted" data-testid="advisory">
              {t("promo.advisory")}
            </p>
          </Page>
        )}
      </TabsContent>
      <TabsContent value="comments">
        <Page className="pt-6 sm:pt-6">
          {version && (
            <CommentsPanel
              promotion={p}
              version={version}
              versions={versions}
              orgRole={role}
              userId={user?.id ?? null}
            />
          )}
        </Page>
      </TabsContent>
      <TabsContent value="compare">
        <Page wide className="pt-6 sm:pt-6">
          <CompareTab versions={versions} />
        </Page>
      </TabsContent>
      <TabsContent value="history">
        <Page className="pt-6 sm:pt-6">
          <HistoryPanel promotion={p} versions={versions} />
        </Page>
      </TabsContent>
      <TabsContent value="info">
        <Page wide className="pt-6 sm:pt-6">
          <InfoPanel
            promotion={p}
            bundle={bundle}
            canEdit={canEdit && isLatest}
            currentVersion={latest}
            selected={version}
            canCheckLicense={
              ["owner", "admin", "compliance_lead"].includes(role ?? "") ||
              (role === "reviewer" && p.assigned_reviewer_id === user?.id)
            }
          />
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <LinkedClaims
              promotion={p}
              current={latest}
              canLink={
                !p.is_demo &&
                isLatest &&
                (isOwner || ["owner", "admin", "reviewer", "creator"].includes(role ?? ""))
              }
            />
            <VariationsCard promotion={p} canEdit={canEdit} />
            <LifecyclePanel promotion={p} orgRole={role} isOwner={isOwner} />
            <ReadabilityPanel promotion={p} />
          </div>
        </Page>
      </TabsContent>
    </Tabs>
  );
}

const result = (v: VersionSummary | null) => v?.status === "done";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="truncate font-medium" dir="auto">
        {children}
      </dd>
    </div>
  );
}

/** Role-specific next step (§8.2): what this user should do now, with the actions the server allows. */
function NextStep({
  promotion: p,
  latest,
  analysis,
  me,
  canUpload,
  onTab,
}: {
  promotion: Promotion;
  latest: VersionSummary | null;
  analysis: AnalysisState;
  me: { userId: string | null; orgRole: string | null; isOwner: boolean };
  canUpload: boolean;
  onTab: (t: string) => void;
}) {
  const { t } = useI18n();
  const role = me.orgRole ?? "";
  const s = p.review_status;
  const uploadedIt = Boolean(latest && me.userId && latest.user_id === me.userId);
  const uploaderSide =
    (me.isOwner || uploadedIt || ["owner", "admin", "creator"].includes(role)) &&
    role !== "reviewer";
  const decider = ["owner", "admin", "compliance_lead", "reviewer"].includes(role) && !uploadedIt;
  const assigner = ["owner", "admin", "compliance_lead"].includes(role);
  let key: string = "none";
  if (!p.org_id) key = "personal";
  else if (["queued", "extracting", "transcribing", "analyzing"].includes(analysis))
    key = "marketer.analysis_running";
  else if (role === "legal")
    key = s === "escalated" && p.escalated_to === me.userId ? "legal.answer" : "legal.none";
  else if (decider && s === "pending_review" && !p.assigned_reviewer_id && assigner)
    key = "admin.assign";
  else if (
    decider &&
    s === "pending_review" &&
    (role !== "reviewer" || p.assigned_reviewer_id === me.userId)
  )
    key = "reviewer.start";
  else if (
    decider &&
    s === "in_review" &&
    (role !== "reviewer" || p.assigned_reviewer_id === me.userId)
  )
    key = "reviewer.decide";
  else if (
    decider &&
    s === "conditionally_approved" &&
    (role !== "reviewer" || p.assigned_reviewer_id === me.userId)
  )
    key = "reviewer.verify_conditions";
  else if (role === "reviewer" && ["pending_review", "in_review"].includes(s))
    key = "reviewer.not_assigned";
  else if (uploaderSide && analysis === "failed") key = "marketer.analysis_failed";
  else if (uploaderSide && s === "draft") key = "marketer.respond_submit";
  else if (uploaderSide && s === "changes_requested") key = "marketer.fix_changes";
  else if (uploaderSide && s === "rejected") key = "marketer.rejected";
  else if (uploaderSide && s === "conditionally_approved") key = "marketer.fulfill_conditions";
  else if (uploaderSide && ["pending_review", "in_review", "escalated"].includes(s))
    key = "marketer.wait_review";
  else if (s === "approved") key = "all.approved";
  if (key === "personal") return null;
  const showFindings = [
    "reviewer.decide",
    "marketer.respond_submit",
    "marketer.fix_changes",
  ].includes(key);
  return (
    <section
      aria-labelledby="next-step"
      data-testid="next-step"
      className="flex flex-col gap-3 rounded-lg border border-ink/15 bg-sunken p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id="next-step" className="text-xs font-bold tracking-wide text-fg-muted uppercase">
            {t("ws.next.title")}
          </p>
          <p className="mt-1 text-base font-bold">{t(`ws.next.${key}` as TKey)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showFindings && (
            <Button size="sm" variant="secondary" onClick={() => onTab("analysis")}>
              {t("ws.next.openFindings")}
            </Button>
          )}
          {canUpload && key === "marketer.fix_changes" && (
            <Button size="sm" asChild icon={<Sparkles />} variant="secondary">
              <Link to="/promotions/$id/fix" params={{ id: p.id }}>
                {t("ws.header.openFix")}
              </Link>
            </Button>
          )}
        </div>
      </div>
      <ReviewActions promotion={p} current={latest} me={me} />
    </section>
  );
}

/** The latest human decision, prominently (§14): who, when, which version, reasons, explanation, checklist. */
function DecisionSummary({
  promotion: p,
  versions,
  people,
  canUpload,
}: {
  promotion: Promotion;
  versions: VersionSummary[];
  people?: Record<string, { name: string; role: string }>;
  canUpload: boolean;
}) {
  const { t, lang, formatDate } = useI18n();
  const history = useQuery({
    queryKey: rk.history(p.id),
    queryFn: () =>
      fetchHistory(
        p.id,
        versions.map((v) => v.id),
      ),
    enabled: Boolean(p.org_id),
  });
  const reasons = useQuery({
    queryKey: rk.reasons(p.org_id),
    queryFn: () => fetchReasons(p.org_id),
  });
  const shown = ["changes_requested", "rejected", "conditionally_approved", "approved"];
  if (!shown.includes(p.review_status)) return null;
  const d: ReviewDecision | undefined = [...(history.data?.decisions ?? [])]
    .reverse()
    .find((x) =>
      ["approve", "conditional_approve", "request_changes", "reject"].includes(x.decision),
    );
  if (!d) return null;
  const v = versions.find((x) => x.id === d.submission_id);
  const reasonLabels = (d.reason_ids ?? [])
    .map((id) => reasons.data?.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => (lang === "en" ? r!.label_en : r!.label_ar));
  if (d.reason_other) reasonLabels.push(d.reason_other);
  const tone =
    d.decision === "approve"
      ? "border-green/30 bg-green-bg/50"
      : d.decision === "conditional_approve"
        ? "border-amber/30 bg-amber-bg"
        : "border-red/30 bg-red-bg/60";
  const newVersionSince = d.submission_id !== p.current_version_id;
  return (
    <section
      data-testid="decision-summary"
      aria-labelledby="decision-summary"
      className={cn("flex flex-col gap-3 rounded-lg border p-4 sm:p-5", tone)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="decision-summary" className="flex items-center gap-2 text-lg font-bold">
            {d.decision !== "approve" && <AlertTriangle aria-hidden="true" className="size-5" />}
            {t(`ws.decisionSummary.title.${d.decision}` as TKey)}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {t("ws.decisionSummary.meta", {
              who: people?.[d.actor_id]?.name ?? t(`org.roles.${d.actor_role}` as TKey),
              date: formatDate(d.created_at, true),
              n: v?.version_no ?? "—",
            })}
          </p>
        </div>
        {canUpload && ["request_changes", "reject"].includes(d.decision) && !newVersionSince && (
          <div className="flex flex-wrap gap-2">
            <Button asChild icon={<Upload />}>
              <Link to="/new" search={{ promotion: p.id }}>
                {t("ws.header.uploadRevision")}
              </Link>
            </Button>
            <Button asChild variant="secondary" icon={<Sparkles />}>
              <Link to="/promotions/$id/fix" params={{ id: p.id }}>
                {t("ws.header.openFix")}
              </Link>
            </Button>
          </div>
        )}
      </div>
      {reasonLabels.length > 0 && (
        <div>
          <p className="text-sm font-bold">{t("ws.decisionSummary.reasons")}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {reasonLabels.map((r) => (
              <li key={r}>
                <Badge variant="outline">{r}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.comment && (
        <div>
          <p className="text-sm font-bold">{t("ws.decisionSummary.explanation")}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm" dir="auto">
            {d.comment}
          </p>
        </div>
      )}
      {["request_changes", "reject"].includes(d.decision) && <CorrectionChecklist decision={d} />}
      {newVersionSince && ["request_changes", "reject"].includes(d.decision) && (
        <p className="text-sm text-fg-muted">{t("ws.decisionSummary.newVersionSince")}</p>
      )}
    </section>
  );
}

/** Findings the decision was taken on (from its immutable snapshot) that still need correction. */
function CorrectionChecklist({ decision: d }: { decision: ReviewDecision }) {
  const { t, lang } = useI18n();
  const snap = (Array.isArray(d.findings_snapshot) ? d.findings_snapshot : []) as {
    rule_code?: string;
    severity?: string;
    status?: string;
    explanation_ar?: string | null;
    explanation_en?: string | null;
    fix_ar?: string | null;
  }[];
  const items = snap.filter(
    (f) => !["dismissed", "not_required", "resolved", "verified"].includes(f.status ?? "open"),
  );
  if (!items.length) return null;
  // One line per rule + explanation: repeated evidence of the same claim is one correction.
  const seen = new Set<string>();
  const lines = items.filter((f) => {
    const k = `${f.rule_code}|${f.explanation_ar ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <div data-testid="correction-checklist">
      <p className="text-sm font-bold">{t("ws.decisionSummary.checklist")}</p>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {lines.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-1 inline-block size-3 shrink-0 rounded-sm border border-fg-muted"
            />
            <span>
              <Badge mono className="me-1">
                {f.rule_code}
              </Badge>
              {(lang === "en" ? f.explanation_en : f.explanation_ar) || f.explanation_ar}
              {f.fix_ar && lang === "ar" && <span className="block text-fg-muted">{f.fix_ar}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle>{title}</CardTitle>
      {note && <p className="text-xs text-fg-muted">{note}</p>}
      <dl className="divide-y divide-border">{children}</dl>
    </Card>
  );
}
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </div>
  );
}

function InfoPanel({
  promotion: p,
  bundle,
  canEdit,
  currentVersion,
  selected,
  canCheckLicense,
}: {
  promotion: Promotion;
  bundle: PromotionBundle;
  canEdit: boolean;
  currentVersion: VersionSummary | null;
  selected: VersionSummary | null;
  canCheckLicense: boolean;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const products = useProducts(p.org_id);
  const [editing, setEditing] = useState(false);
  const [changed, setChanged] = useState(false);
  const [title, setTitle] = useState(p.title);
  const [caption, setCaption] = useState(p.caption ?? "");
  const [ctx, setCtx] = useState<ContextValue>({
    productId: p.product_id,
    channels: p.channels,
    communicationType: p.communication_type,
    audience: p.audience,
    isPaid: p.is_paid,
    distribution: p.distribution as ContextValue["distribution"],
    creatorLicenseNo: p.creator_license_no,
    reviewerNotes: p.reviewer_notes,
    deadlineAt: p.deadline_at,
  });
  const date = (s: string | null) =>
    s
      ? new Date(s).toLocaleDateString(lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")
      : t("common.none");
  const list = (xs: string[], prefix: string) =>
    xs.length ? xs.map((x) => t(`${prefix}.${x}` as TKey)).join("، ") : t("common.none");

  const save = useMutation({
    mutationFn: () => updatePromotionContext(p.id, { ...ctx, title, caption }),
    onSuccess: () => {
      toast.success(t("promo.contextSaved"));
      setEditing(false);
      if (currentVersion?.status === "done") setChanged(true);
      void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
      void qc.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (e) => toast.error(t(`promo.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey)),
  });
  const rerun = useMutation({
    mutationFn: () => rerunSubmission(currentVersion!.id),
    onSuccess: () => {
      toast.success(t("promo.rerunStarted"));
      setChanged(false);
      void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
      void qc.invalidateQueries({ queryKey: ["submission", currentVersion!.id] });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  const canRerun = Boolean(user && currentVersion && currentVersion.user_id === user.id);
  const product = bundle.product;
  // «غير مُسند» only for the reviewer slot; an unknown creator is «—».
  const person = (id: string | null | undefined, empty = t("ws.header.unassigned")) =>
    id ? (bundle.people?.[id]?.name ?? t("ws.header.unknownPerson")) : empty;

  return (
    <div className="flex flex-col gap-4">
      {changed && (
        <div
          role="status"
          data-testid="context-changed"
          className="flex flex-col gap-3 rounded-md border border-amber/30 bg-amber-bg p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-bold text-amber-text">{t("promo.contextChangedTitle")}</p>
            <p className="mt-1 text-fg">{t("promo.contextChangedBody")}</p>
          </div>
          {canRerun && (
            <Button icon={<RefreshCw />} loading={rerun.isPending} onClick={() => rerun.mutate()}>
              {t("promo.rerun")}
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">
          {canEdit ? t("ws.info.editableNote") : t("ws.info.readOnlyNote")}
          {selected && selected.id !== currentVersion?.id && ` ${t("ws.info.snapshotNote")}`}
        </p>
        {canEdit && !editing && (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {t("promo.editContext")}
          </Button>
        )}
      </div>
      {editing ? (
        <Card>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label={t("promo.fieldTitle")}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                dir="auto"
              />
            </Field>
            <Field label={t("promo.fieldCaption")} optional optionalLabel={t("common.optional")}>
              <Textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                dir="auto"
              />
            </Field>
            {p.org_id && (
              <ContextFields value={ctx} onChange={setCtx} products={products.data ?? []} />
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t("promo.saveContext")}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Section title={t("ws.info.details")}>
            <InfoRow label={t("promo.fieldTitle")}>{p.title}</InfoRow>
            <InfoRow label={t("promo.fieldCaption")}>
              <span dir="auto" className="whitespace-pre-wrap">
                {p.caption || t("common.none")}
              </span>
            </InfoRow>
            <InfoRow label={t("ws.header.creator")}>
              {person(currentVersion?.user_id ?? p.owner_id, "—")}
            </InfoRow>
            <InfoRow label={t("ws.header.campaign")}>
              {bundle.campaign?.name ?? t("common.none")}
            </InfoRow>
            <InfoRow label={t("promo.product")}>
              {product
                ? (lang === "en" && product.name_en) || product.name_ar
                : t("promo.noProduct")}
            </InfoRow>
            <InfoRow label={t("ws.info.currentVersion")}>
              {t("ws.header.version", { n: currentVersion?.version_no ?? 0 })}
            </InfoRow>
          </Section>
          <Section title={t("ws.info.publication")}>
            <InfoRow label={t("promo.channels")}>{list(p.channels, "promo.channel")}</InfoRow>
            <InfoRow label={t("promo.audience")}>{list(p.audience, "promo.audienceOpt")}</InfoRow>
            <InfoRow label={t("promo.paid")}>
              {p.is_paid === null
                ? t("promo.unknown")
                : p.is_paid
                  ? t("common.yes")
                  : t("common.no")}
            </InfoRow>
            <InfoRow label={t("promo.distribution")}>
              {p.distribution
                ? t(`promo.distributionOpt.${p.distribution}` as TKey)
                : t("promo.unknown")}
            </InfoRow>
            <InfoRow label={t("promo.deadline")}>{date(p.deadline_at)}</InfoRow>
          </Section>
          <Section title={t("ws.info.regulatory")}>
            <InfoRow label={t("ws.info.sector")}>
              {t(`ws.sector.${p.sector ?? product?.sector ?? "other"}` as TKey)}
            </InfoRow>
            <InfoRow label={t("ws.info.productType")}>
              {product ? t(`ws.productType.${product.product_type}` as TKey) : t("common.none")}
            </InfoRow>
            <InfoRow label={t("promo.communicationType")}>
              {t(`promo.commType.${p.communication_type}` as TKey)}
            </InfoRow>
            <InfoRow label={t("ws.info.packs")}>
              <span className="text-sm text-fg-muted">{t("ws.info.packsHint")}</span>
            </InfoRow>
          </Section>
          <ProductCampaignSections bundle={bundle} />
          <DeclarationsSection
            promotion={p}
            version={selected ?? currentVersion}
            canCheckLicense={canCheckLicense}
          />
          <WorkflowSection promotion={p} versions={bundle.versions} person={person} />
        </div>
      )}
    </div>
  );
}
