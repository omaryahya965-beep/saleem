import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, Link2Off, MessageSquare, Share2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  IssueCard,
  Page,
  Select,
  Skeleton,
  StatusChip,
  Textarea,
  Input,
  toast,
  type IssueView,
} from "@/components/ui";
import { Disclaimer } from "@/features/reports/ReportView";
import { useI18n } from "@/i18n";
import {
  createShareLink,
  errorCode,
  fetchSharedReport,
  fetchShares,
  revokeShareLink,
  submitShareReview,
} from "@/lib/api/features";

const decisionTone = {
  approved: "ready",
  changes_requested: "violation",
  comment: "neutral",
} as const;

function ReviewList({
  reviews,
}: {
  reviews: {
    decision: string;
    comment: string | null;
    reviewer_name: string;
    created_at: string;
  }[];
}) {
  const { t, formatDate } = useI18n();
  if (!reviews.length) return <p className="text-sm text-fg-muted">{t("share.noReviews")}</p>;
  return (
    <ol className="flex flex-col gap-3">
      {reviews.map((r, i) => (
        <li key={i} className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              size="sm"
              tone={decisionTone[r.decision as keyof typeof decisionTone] ?? "neutral"}
            >
              {t(`share.decision.${r.decision}` as never)}
            </StatusChip>
            <span className="font-medium">{r.reviewer_name}</span>
            <span className="text-fg-muted">{formatDate(r.created_at, true)}</span>
          </div>
          {r.comment && (
            <p dir="auto" className="mt-2 whitespace-pre-wrap text-fg">
              {r.comment}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Owner-side: create/revoke expiring read-only links and see brand decisions. */
export function ShareDialog({
  submissionId,
  open,
  onOpenChange,
}: {
  submissionId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const [days, setDays] = useState("7");
  const shares = useQuery({
    queryKey: ["shares", submissionId],
    queryFn: () => fetchShares(submissionId),
    enabled: open,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["shares", submissionId] });
  const create = useMutation({
    mutationFn: () => createShareLink(submissionId, Number(days)),
    onSuccess: (token) => {
      void navigator.clipboard
        ?.writeText(`${window.location.origin}/share/${token}`)
        .then(() => toast.success(t("share.copied")));
      void refresh();
    },
    onError: (e) => toast.error(t(`quota.${errorCode(e)}` as never)),
  });
  const revoke = useMutation({ mutationFn: revokeShareLink, onSuccess: () => void refresh() });
  const active = (shares.data?.links ?? []).filter(
    (l) => !l.revoked_at && new Date(l.expires_at) > new Date(),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("share.title")}
      description={t("share.body")}
      className="sm:max-w-xl"
    >
      <div className="flex flex-col gap-5 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t("share.expiresIn")} className="sm:w-48">
            <Select value={days} onChange={(e) => setDays(e.target.value)}>
              {[1, 3, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {t("share.days", { n: d })}
                </option>
              ))}
            </Select>
          </Field>
          <Button icon={<Share2 />} loading={create.isPending} onClick={() => create.mutate()}>
            {t("share.create")}
          </Button>
        </div>
        {active.length > 0 && (
          <ul className="flex flex-col gap-2">
            {active.map((l) => {
              const url = `${window.location.origin}/share/${l.token}`;
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2"
                >
                  <code dir="ltr" className="min-w-0 flex-1 truncate font-mono text-xs">
                    {url}
                  </code>
                  <span className="hidden text-xs text-fg-muted sm:inline">
                    {t("share.until", { date: formatDate(l.expires_at) })}
                  </span>
                  <IconButton
                    size="sm"
                    label={t("common.copy")}
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(url)
                        .then(() => toast.success(t("common.copied")))
                    }
                  >
                    <Copy />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={t("share.revoke")}
                    onClick={() => revoke.mutate(l.id)}
                  >
                    <Link2Off />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
        <div>
          <CardTitle className="mb-2 text-base">{t("share.history")}</CardTitle>
          {shares.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <ReviewList reviews={shares.data?.reviews ?? []} />
          )}
        </div>
      </div>
    </Dialog>
  );
}

/** Public /share/$token — read-only report for a brand with approve / request changes. */
export function SharePage({ token }: { token: string }) {
  const { t, tn, lang, formatDate } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shared", token], queryFn: () => fetchSharedReport(token) });
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [nameErr, setNameErr] = useState<string>();
  const review = useMutation({
    mutationFn: (d: "approved" | "changes_requested" | "comment") =>
      submitShareReview(token, d, comment, name),
    onSuccess: () => {
      setComment("");
      toast.success(t("share.sent"));
      void qc.invalidateQueries({ queryKey: ["shared", token] });
    },
    onError: (e) => toast.error(t(`quota.${errorCode(e)}` as never)),
  });

  const issues = useMemo<IssueView[]>(() => {
    const d = q.data;
    if (!d?.valid) return [];
    const rules = new Map((d.rules ?? []).map((r) => [r.code, r]));
    return (d.findings ?? []).map((f) => {
      const r = rules.get(f.rule_code);
      return {
        id: f.id,
        severity: f.severity,
        time: f.t_start === null ? null : Number(f.t_start),
        title:
          (lang === "en" ? f.explanation_en : f.explanation_ar) || f.explanation_ar || f.rule_code,
        ruleCode: f.rule_code,
        ruleTitle: r ? (lang === "en" ? r.title_en : r.title_ar) : f.rule_code,
        sourceName: (lang === "en" ? r?.source_name_en : null) || r?.source_name || "",
        sourceUrl: r?.source_url || null,
        evidenceType: f.evidence_type as IssueView["evidenceType"],
        evidence: f.evidence_text,
        fix: ((lang === "en" ? f.fix_en : f.fix_ar) || f.fix_ar) ?? "",
      };
    });
  }, [q.data, lang]);

  if (q.isPending)
    return (
      <Page narrow>
        <Skeleton className="h-64 w-full rounded-lg" />
      </Page>
    );
  if (!q.data?.valid)
    return (
      <Page narrow>
        <EmptyState
          icon={<Link2Off />}
          title={t("share.invalidTitle")}
          body={t("share.invalidBody")}
        />
      </Page>
    );

  const s = q.data.submission!;
  const v = issues.filter((i) => i.severity === "violation").length;
  const w = issues.length - v;
  const tone =
    s.overall_status === "ready"
      ? "ready"
      : s.overall_status === "review"
        ? "warning"
        : "violation";
  const send = (d: "approved" | "changes_requested" | "comment") => {
    if (!name.trim()) return setNameErr(t("auth.errName"));
    setNameErr(undefined);
    review.mutate(d);
  };

  return (
    <Page narrow className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Badge variant="outline">
          {t("share.readOnly", { date: formatDate(q.data.expires_at) })}
        </Badge>
      </div>
      <Card className="flex flex-col gap-2">
        <StatusChip tone={tone} className="self-start">
          {t(`status.${s.overall_status ?? "needs_fixes"}` as never)}
        </StatusChip>
        <h1 dir="auto" className="text-2xl font-bold">
          {s.title || t("dashboard.untitled")}
        </h1>
        <p className="text-fg-muted">
          {t(`platforms.${s.platform}` as never)} · {formatDate(s.analyzed_at)} ·{" "}
          {tn("count.violations", v)} · {tn("count.warnings", w)} · {t("report.factRulebook")}{" "}
          <span dir="ltr">{q.data.rulebook_version}</span>
        </p>
        {s.caption && (
          <p dir="auto" className="rounded-md bg-sunken p-3 text-sm">
            {s.caption}
          </p>
        )}
      </Card>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">
          {t("report.issuesHeading")} ({issues.length})
        </h2>
        {issues.map((i) => (
          <IssueCard key={i.id} issue={i} />
        ))}
      </section>
      <Card className="flex flex-col gap-4">
        <CardTitle>{t("share.yourDecision")}</CardTitle>
        <Field label={t("share.name")} error={nameErr}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            dir="auto"
            autoComplete="name"
          />
        </Field>
        <Field label={t("share.comment")} optional optionalLabel={t("common.optional")}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            dir="auto"
            maxLength={2000}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            icon={<CheckCircle2 />}
            loading={review.isPending && review.variables === "approved"}
            onClick={() => send("approved")}
          >
            {t("share.approve")}
          </Button>
          <Button
            variant="secondary"
            icon={<XCircle />}
            loading={review.isPending && review.variables === "changes_requested"}
            onClick={() => send("changes_requested")}
          >
            {t("share.requestChanges")}
          </Button>
          <Button
            variant="ghost"
            icon={<MessageSquare />}
            loading={review.isPending && review.variables === "comment"}
            onClick={() => send("comment")}
          >
            {t("share.commentOnly")}
          </Button>
        </div>
        <div className="border-t border-border pt-4">
          <h3 className="mb-2 font-bold">{t("share.history")}</h3>
          <ReviewList reviews={q.data.reviews ?? []} />
        </div>
      </Card>
      <Disclaimer />
    </Page>
  );
}
