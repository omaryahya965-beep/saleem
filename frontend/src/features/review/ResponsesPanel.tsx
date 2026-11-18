import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, CardTitle, Dialog, Field, Textarea, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import {
  COMMENT_REQUIRED,
  REVIEWER_ACTIONS,
  UPLOADER_ACTIONS,
  respondFinding,
  rk,
  useResponses,
  type ResponseAction,
} from "@/lib/api/review";
import { usePreflightText } from "./model";
import { ClaimFromFindingDialog } from "@/features/libraries/LinkedClaims";

interface FindingRow {
  id: string;
  rule_code: string;
  finding_type: string | null;
  status: string;
  explanation_ar: string | null;
  explanation_en: string | null;
  evidence_text: string | null;
}

async function latestFindings(submissionId: string): Promise<FindingRow[]> {
  const { data: run } = await supabase
    .from("analysis_runs")
    .select("id")
    .eq("submission_id", submissionId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run) return [];
  const { data } = await supabase
    .from("findings")
    .select("id, rule_code, finding_type, status, explanation_ar, explanation_en, evidence_text")
    .eq("run_id", run.id)
    .order("rule_code");
  return (data ?? []) as FindingRow[];
}

const UPLOADER_STATUSES = new Set([
  "draft",
  "changes_requested",
  "rejected",
  "conditionally_approved",
  "pending_review",
]);
const REVIEWER_STATUSES = new Set(["in_review", "escalated"]);

/** Structured responses to the current version's findings (05_UX_SPEC §6.4), with their history. */
export function ResponsesPanel({
  promotion: p,
  version,
  orgRole,
  userId,
  isOwner,
}: {
  promotion: Promotion;
  version: VersionSummary;
  orgRole: string | null;
  userId: string | null;
  isOwner: boolean;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const findings = useQuery({
    queryKey: ["latest-findings", version.id],
    queryFn: () => latestFindings(version.id),
  });
  const responses = useResponses(version.id);
  const [pending, setPending] = useState<{ finding: string; action: ResponseAction } | null>(null);
  const [claimFix, setClaimFix] = useState<FindingRow | null>(null);
  const errText = usePreflightText();
  const uploader =
    (isOwner || ["owner", "admin", "creator"].includes(orgRole ?? "")) &&
    UPLOADER_STATUSES.has(p.review_status);
  const reviewer =
    ["owner", "admin", "reviewer"].includes(orgRole ?? "") &&
    version.user_id !== userId &&
    REVIEWER_STATUSES.has(p.review_status);
  const respond = useMutation({
    mutationFn: (v: { finding: string; action: ResponseAction; comment: string }) =>
      respondFinding(v.finding, v.action, v.comment),
    onSuccess: () => {
      toast.success(t("review.responses.respondedToast"));
      setPending(null);
      void qc.invalidateQueries({ queryKey: rk.responses(version.id) });
      void qc.invalidateQueries({ queryKey: ["latest-findings", version.id] });
      void qc.invalidateQueries({ queryKey: ["can-submit", p.id] });
      void qc.invalidateQueries({ queryKey: ["can-decide", p.id] });
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!p.org_id || p.is_demo || !findings.data?.length) return null;
  const actions = reviewer ? REVIEWER_ACTIONS : uploader ? UPLOADER_ACTIONS : [];
  const click = (finding: string, action: ResponseAction) =>
    COMMENT_REQUIRED.has(action) || action === "reply"
      ? setPending({ finding, action })
      : respond.mutate({ finding, action, comment: "" });

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-4 pb-8 sm:px-8"
      data-testid="responses-panel"
    >
      <Card className="flex flex-col gap-3">
        <CardTitle>{t("review.responses.history")}</CardTitle>
        <ul className="flex flex-col divide-y divide-border">
          {findings.data.map((f) => {
            const history = (responses.data ?? []).filter((r) => r.finding_id === f.id);
            return (
              <li key={f.id} className="flex flex-col gap-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge mono>{f.rule_code}</Badge>
                  <Badge>{t(`review.status.${f.status}` as TKey)}</Badge>
                  <span className="text-sm text-fg">
                    {(lang === "en" ? f.explanation_en : f.explanation_ar) ?? ""}
                  </span>
                </div>
                {f.rule_code === "SYS-CLAIMS" &&
                  f.status !== "resolved" &&
                  ["owner", "admin", "reviewer", "creator"].includes(orgRole ?? "") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="self-start"
                      onClick={() => setClaimFix(f)}
                    >
                      {t("claims.fromFinding")}
                    </Button>
                  )}
                {f.status !== "resolved" && actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {actions.map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant="secondary"
                        loading={
                          respond.isPending &&
                          respond.variables?.finding === f.id &&
                          respond.variables.action === a
                        }
                        onClick={() => click(f.id, a)}
                      >
                        {t(`review.responses.${a}` as TKey)}
                      </Button>
                    ))}
                  </div>
                )}
                {history.length > 0 && (
                  <ul className="flex flex-col gap-1 text-xs text-fg-muted">
                    {history.map((r) => (
                      <li key={r.id}>
                        <span className="font-medium text-fg">
                          {t(`review.responses.${r.actor_role}` as TKey)}
                        </span>
                        : {t(`review.responses.${r.action}` as TKey)}
                        {r.comment ? ` — ${r.comment}` : ""} ·{" "}
                        {new Date(r.created_at).toLocaleString(
                          lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      {claimFix && p.org_id && (
        <ClaimFromFindingDialog
          finding={claimFix}
          orgId={p.org_id}
          canApprove={["owner", "admin", "reviewer"].includes(orgRole ?? "")}
          onClose={() => setClaimFix(null)}
          onDone={() => void qc.invalidateQueries({ queryKey: ["latest-findings", version.id] })}
        />
      )}
      {pending && (
        <CommentDialog
          title={t(`review.responses.${pending.action}` as TKey)}
          loading={respond.isPending}
          onClose={() => setPending(null)}
          onConfirm={(comment) => respond.mutate({ ...pending, comment })}
        />
      )}
    </section>
  );
}

function CommentDialog({
  title,
  loading,
  onClose,
  onConfirm,
}: {
  title: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (c: string) => void;
}) {
  const { t } = useI18n();
  const [comment, setComment] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={loading} disabled={!comment.trim()} onClick={() => onConfirm(comment)}>
            {t("common.confirm")}
          </Button>
        </>
      }
    >
      <Field label={t("review.responses.commentLabel")}>
        <Textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          dir="auto"
        />
      </Field>
    </Dialog>
  );
}
