import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, RotateCcw } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { bothCalendars, usePreflightText } from "@/features/review/model";
import {
  completeRereview,
  flagOn,
  markWithdrawn,
  recordLifecycle,
  requestWithdrawal,
  riyadhIso,
  setEvergreen,
} from "@/lib/api/flows";
import { pk, useOrgSettings, type Promotion } from "@/lib/api/promotions";

const LIVE = ["approved", "conditionally_approved", "risk_accepted", "due_for_rereview"];

/** Evergreen re-review date, lifecycle dates and regulator withdrawal deadline (Phase 6.5). */
export function LifecyclePanel({
  promotion: p,
  orgRole,
  isOwner,
}: {
  promotion: Promotion;
  orgRole: string | null;
  isOwner: boolean;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(p.org_id);
  const errText = usePreflightText();
  const [evergreen, setEg] = useState(p.evergreen);
  const [next, setNext] = useState(p.next_review_at ?? "");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
  const onError = (e: unknown) => toast.error(errText(e));
  const saveEg = useMutation({
    mutationFn: () => setEvergreen(p.id, evergreen, next || null),
    onSuccess: () => {
      toast.success(t("lifecycle.saved"));
      refresh();
    },
    onError,
  });
  const record = useMutation({
    mutationFn: (e: "published" | "taken_down") => recordLifecycle(p.id, e, null),
    onSuccess: refresh,
    onError,
  });
  const withdraw = useMutation({
    mutationFn: () => requestWithdrawal(p.id, riyadhIso(notice), reason),
    onSuccess: () => {
      setNotice("");
      refresh();
    },
    onError,
  });
  const done = useMutation({
    mutationFn: () => markWithdrawn(p.id, ""),
    onSuccess: refresh,
    onError,
  });
  if (!p.org_id || p.is_demo || !flagOn(settings.data?.features, "lifecycle")) return null;
  const editor = isOwner || ["owner", "admin", "reviewer", "creator"].includes(orgRole ?? "");
  const manager = ["owner", "admin"].includes(orgRole ?? "");
  const when = (iso: string | null) => (iso ? bothCalendars(iso, lang) : "—");
  return (
    <Card className="flex flex-col gap-4" data-testid="lifecycle-panel">
      <CardTitle>{t("lifecycle.title")}</CardTitle>
      {editor && (
        <div className="flex flex-wrap items-end gap-3">
          <Checkbox
            label={t("lifecycle.evergreen")}
            hint={t("lifecycle.evergreenHint")}
            checked={evergreen}
            onChange={(e) => setEg(e.target.checked)}
          />
          <Field label={t("lifecycle.nextReview")}>
            <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} dir="ltr" />
          </Field>
          <Button
            size="sm"
            variant="secondary"
            loading={saveEg.isPending}
            disabled={evergreen && !next}
            onClick={() => saveEg.mutate()}
          >
            {t("common.save")}
          </Button>
        </div>
      )}
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-fg-muted">{t("lifecycle.published")}</dt>
          <dd>{when(p.published_at)}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t("lifecycle.takenDown")}</dt>
          <dd>{when(p.taken_down_at)}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">{t("lifecycle.withdrawn")}</dt>
          <dd>
            {when(p.withdrawn_at)}
            {p.withdrawal_reason ? ` — ${p.withdrawal_reason}` : ""}
          </dd>
        </div>
      </dl>
      {editor && LIVE.includes(p.review_status) && (
        <div className="flex flex-wrap gap-2">
          {!p.published_at && (
            <Button
              size="sm"
              variant="secondary"
              loading={record.isPending}
              onClick={() => record.mutate("published")}
            >
              {t("lifecycle.markPublished")}
            </Button>
          )}
          {p.published_at && !p.taken_down_at && (
            <Button
              size="sm"
              variant="secondary"
              loading={record.isPending}
              onClick={() => record.mutate("taken_down")}
            >
              {t("lifecycle.markTakenDown")}
            </Button>
          )}
        </div>
      )}
      {p.withdrawal_due_at && !p.withdrawn_at && (
        <p
          role="status"
          className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm text-amber-text"
        >
          <CalendarClock className="me-1 inline size-4" aria-hidden="true" />
          {t("lifecycle.withdrawalDue")}: <strong>{when(p.withdrawal_due_at)}</strong> —{" "}
          {t("lifecycle.notLegalAdvice")}
        </p>
      )}
      {manager && LIVE.includes(p.review_status) && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <h3 className="text-sm font-bold">{t("lifecycle.withdrawalTitle")}</h3>
          <div className="grid items-end gap-2 sm:grid-cols-[14rem_1fr_auto]">
            <Field label={t("lifecycle.noticeAt")}>
              <Input
                type="datetime-local"
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label={t("lifecycle.reason")}>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" />
            </Field>
            <Button
              size="sm"
              variant="secondary"
              disabled={!notice || !reason.trim()}
              loading={withdraw.isPending}
              onClick={() => withdraw.mutate()}
            >
              {t("lifecycle.record")}
            </Button>
          </div>
          <p className="text-xs text-fg-muted">{t("lifecycle.deadlineRule")}</p>
          {(p.withdrawal_reason || reason.trim()) && (
            <Button
              size="sm"
              className="self-start"
              loading={done.isPending}
              onClick={() => window.confirm(t("lifecycle.confirmWithdrawn")) && done.mutate()}
            >
              {t("lifecycle.markWithdrawn")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** Reviewer action for a due evergreen promotion: still valid with a new date, or request changes (sealed). */
export function RereviewAction({
  promotion: p,
  canAct,
  onDone,
}: {
  promotion: Promotion;
  canAct: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const [open, setOpen] = useState(false);
  const [valid, setValid] = useState(true);
  const [next, setNext] = useState("");
  const [comment, setComment] = useState("");
  const run = useMutation({
    mutationFn: () => completeRereview(p.id, valid, valid ? next : null, comment),
    onSuccess: () => {
      toast.success(t("review.decidedToast"));
      onDone();
      setOpen(false);
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (p.review_status !== "due_for_rereview" || !canAct) return null;
  return (
    <>
      <Button icon={<RotateCcw />} onClick={() => setOpen(true)}>
        {t("lifecycle.rereview")}
      </Button>
      {open && (
        <Dialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title={t("lifecycle.rereview")}
          description={t("review.humanDecisionNote")}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                loading={run.isPending}
                disabled={valid ? !next : !comment.trim()}
                onClick={() => run.mutate()}
              >
                {t("review.confirmDecision")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Checkbox
              label={t("lifecycle.stillValid")}
              checked={valid}
              onChange={(e) => setValid(e.target.checked)}
            />
            {valid ? (
              <Field label={t("lifecycle.nextReview")}>
                <Input
                  type="date"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  dir="ltr"
                />
              </Field>
            ) : null}
            <Field label={valid ? t("review.comment") : t("lifecycle.changesNeeded")}>
              <Textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                dir="auto"
              />
            </Field>
          </div>
        </Dialog>
      )}
    </>
  );
}
