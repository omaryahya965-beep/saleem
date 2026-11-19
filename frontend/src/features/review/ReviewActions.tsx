import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, Scale, Send, UserCheck } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox, Dialog, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "./model";
import { FlowPanel, SubmitFlowSection } from "@/features/enterprise/FlowPanel";
import { RiskPanel } from "@/features/enterprise/RiskPanel";
import { RereviewAction } from "@/features/enterprise/LifecyclePanel";
import { SelfApproveAction } from "@/features/enterprise/SelfApproval";
import { fk, flowLive, submitWithCarry, usePreview, useSteps } from "@/lib/api/flows";
import { pk, type Promotion, type VersionSummary } from "@/lib/api/promotions";
import { can } from "@/lib/permissions";
import {
  archivePromotion,
  assignReviewer,
  canDecide,
  canSubmit,
  decidePromotion,
  escalatePromotion,
  openReview,
  respondEscalation,
  rk,
  submitPromotion,
  useMembers,
  useReasons,
  type DecisionKind,
} from "@/lib/api/review";

const DECISIONS: DecisionKind[] = ["approve", "conditional_approve", "request_changes", "reject"];

function Reasons({ reasons }: { reasons: string[] }) {
  const text = usePreflightText();
  const { t } = useI18n();
  if (!reasons.length) return null;
  return (
    <div
      role="status"
      data-testid="preflight"
      className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm"
    >
      <p className="font-bold text-amber-text">{t("review.blockedTitle")}</p>
      <ul className="mt-1 list-inside list-disc text-fg">
        {reasons.map((r) => (
          <li key={r}>{text(r)}</li>
        ))}
      </ul>
    </div>
  );
}

export interface ReviewRoleInfo {
  userId: string | null;
  orgRole: string | null;
  isOwner: boolean;
}

/** The review actions available to the caller for this promotion (primary action + secondary ones). */
export function ReviewActions({
  promotion: p,
  current,
  me,
}: {
  promotion: Promotion;
  current: VersionSummary | null;
  me: ReviewRoleInfo;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<
    null | "submit" | "decide" | "escalate" | "respond" | "archive"
  >(null);
  const errText = usePreflightText();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
    void qc.invalidateQueries({ queryKey: rk.history(p.id) });
    void qc.invalidateQueries({ queryKey: rk.queue });
    void qc.invalidateQueries({ queryKey: fk.steps(p.id) });
    void qc.invalidateQueries({ queryKey: fk.preview(p.id) });
  };
  const steps = useSteps(p.id);
  const live = flowLive(steps.data ?? []);
  const onError = (e: unknown) => toast.error(errText(e));
  const isUploaderSide = me.isOwner || ["owner", "admin", "creator"].includes(me.orgRole ?? "");
  const isReviewer = ["owner", "admin", "compliance_lead", "reviewer"].includes(me.orgRole ?? "");
  // D169: a reviewer acts only on cases assigned to them (open_review / can_decide enforce it); managers assign.
  const mayAct = me.orgRole !== "reviewer" || p.assigned_reviewer_id === me.userId;
  const awaitingAssignment =
    me.orgRole === "reviewer" &&
    !mayAct &&
    ["pending_review", "in_review"].includes(p.review_status);
  const uploadedIt = Boolean(current && me.userId && current.user_id === me.userId);
  const s = p.review_status;
  const open = useMutation({
    mutationFn: () => openReview(p.id),
    onSuccess: () => {
      toast.success(t("review.openedToast"));
      refresh();
    },
    onError,
  });
  const decidePre = useQuery({
    queryKey: ["can-decide", p.id, s],
    queryFn: () => canDecide(p.id),
    enabled: isReviewer && mayAct && s === "in_review" && !uploadedIt,
  });

  if (!p.org_id || p.is_demo) return null;
  const buttons: React.ReactNode[] = [];
  if (
    isUploaderSide &&
    ["draft", "changes_requested", "rejected", "conditionally_approved"].includes(s)
  )
    buttons.push(
      <Button key="submit" icon={<Send />} onClick={() => setDialog("submit")}>
        {t("review.submit")}
      </Button>,
    );
  if (isReviewer && mayAct && !uploadedIt && s === "pending_review")
    buttons.push(
      <Button
        key="open"
        icon={<UserCheck />}
        loading={open.isPending}
        onClick={() => open.mutate()}
      >
        {t("review.openReview")}
      </Button>,
    );
  if (isReviewer && mayAct && !uploadedIt && s === "in_review" && !live) {
    buttons.push(
      <Button
        key="decide"
        icon={<Gavel />}
        disabled={decidePre.data ? !decidePre.data.ok : true}
        onClick={() => setDialog("decide")}
      >
        {t("review.decide")}
      </Button>,
    );
    buttons.push(
      <Button key="esc" variant="secondary" icon={<Scale />} onClick={() => setDialog("escalate")}>
        {t("review.escalate")}
      </Button>,
    );
  }
  if (me.orgRole === "legal" && s === "escalated" && p.escalated_to === me.userId)
    buttons.push(
      <Button key="respond" icon={<Scale />} onClick={() => setDialog("respond")}>
        {t("review.respondEscalation")}
      </Button>,
    );
  if (
    ["owner", "admin"].includes(me.orgRole ?? "") &&
    !["approved", "archived", "withdrawn"].includes(s)
  )
    buttons.push(
      <Button key="archive" variant="ghost" onClick={() => setDialog("archive")}>
        {t("review.archive")}
      </Button>,
    );

  return (
    <div className="flex flex-col gap-2" data-testid="review-actions">
      {me.orgRole === "legal" && s === "escalated" && p.escalated_to === me.userId && (
        <p className="text-sm font-medium text-amber-text">{t("review.escalatedToYou")}</p>
      )}
      {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons}</div>}
      <RereviewAction promotion={p} canAct={isReviewer && !uploadedIt} onDone={refresh} />
      <SelfApproveAction promotion={p} uploadedIt={uploadedIt} onDone={refresh} />
      <RiskPanel
        promotion={p}
        me={me.userId}
        isUploader={me.isOwner || uploadedIt}
        onDone={refresh}
      />
      {(steps.data ?? []).length > 0 &&
        ["pending_review", "in_review", "approved", "changes_requested", "rejected"].includes(
          s,
        ) && (
          <FlowPanel promotion={p} steps={steps.data ?? []} orgRole={me.orgRole} onDone={refresh} />
        )}
      {isReviewer &&
        !uploadedIt &&
        s === "in_review" &&
        !live &&
        decidePre.data &&
        !decidePre.data.ok && <Reasons reasons={decidePre.data.reasons} />}
      {uploadedIt && isReviewer && ["pending_review", "in_review"].includes(s) && (
        <p className="text-sm text-fg-muted">{t("review.preflight.separation_of_duties")}</p>
      )}
      {awaitingAssignment && (
        <p className="text-sm text-fg-muted" data-testid="awaiting-assignment">
          {t("review.awaitingAssignment")}
        </p>
      )}
      {can(me.orgRole as never, "assign_reviewer") &&
        ["pending_review", "in_review"].includes(s) && (
          <AssignSelect promotion={p} current={current} onDone={refresh} />
        )}
      {dialog === "submit" && (
        <SubmitDialog
          promotion={p}
          current={current}
          onClose={() => setDialog(null)}
          onDone={refresh}
        />
      )}
      {dialog === "decide" && (
        <DecisionDialog promotion={p} onClose={() => setDialog(null)} onDone={refresh} />
      )}
      {dialog === "escalate" && (
        <EscalateDialog promotion={p} onClose={() => setDialog(null)} onDone={refresh} />
      )}
      {dialog === "respond" && (
        <TextActionDialog
          title={t("review.respondEscalation")}
          label={t("review.response")}
          run={(text) => respondEscalation(p.id, text)}
          toastKey="review.respondedToast"
          onClose={() => setDialog(null)}
          onDone={refresh}
        />
      )}
      {dialog === "archive" && (
        <TextActionDialog
          title={t("review.archive")}
          label={t("review.archiveReason")}
          run={(text) => archivePromotion(p.id, text)}
          toastKey="review.archivedToast"
          onClose={() => setDialog(null)}
          onDone={refresh}
        />
      )}
    </div>
  );
}

function AssignSelect({
  promotion: p,
  current,
  onDone,
}: {
  promotion: Promotion;
  current: VersionSummary | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const members = useMembers(p.org_id);
  const errText = usePreflightText();
  const assign = useMutation({
    mutationFn: (u: string) => assignReviewer(p.id, u),
    onSuccess: () => {
      toast.success(t("review.assignedToast"));
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const options = (members.data ?? []).filter(
    (m) => ["owner", "admin", "reviewer"].includes(m.role) && m.user_id !== current?.user_id,
  );
  return (
    <Field label={t("review.assignee")} className="max-w-xs">
      <Select
        value={p.assigned_reviewer_id ?? ""}
        disabled={assign.isPending}
        onChange={(e) => e.target.value && assign.mutate(e.target.value)}
      >
        <option value="">{t("review.unassigned")}</option>
        {options.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name || m.email || m.user_id}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function SubmitDialog({
  promotion: p,
  current,
  onClose,
  onDone,
}: {
  promotion: Promotion;
  current: VersionSummary | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [carry, setCarry] = useState<number[]>([]);
  const flows = usePreview(p.id).data?.enabled === true;
  const errText = usePreflightText();
  const pre = useQuery({
    queryKey: ["can-submit", p.id, note.trim().length > 0, ack],
    queryFn: () => canSubmit(p.id, note, ack),
  });
  const submit = useMutation({
    mutationFn: () =>
      flows ? submitWithCarry(p.id, note, ack, carry) : submitPromotion(p.id, note, ack),
    onSuccess: () => {
      toast.success(t("review.submittedToast"));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("review.submitTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={submit.isPending}
            disabled={!pre.data?.ok}
            onClick={() => submit.mutate()}
          >
            {t("review.submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("review.note")}
          hint={t("review.noteHint")}
          optional
          optionalLabel={t("common.optional")}
        >
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} dir="auto" />
        </Field>
        {current?.status === "failed" && (
          <Checkbox
            label={t("review.ackFailed")}
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
        )}
        <SubmitFlowSection pid={p.id} carry={carry} setCarry={setCarry} />
        {pre.data && <Reasons reasons={pre.data.reasons} />}
      </div>
    </Dialog>
  );
}

function DecisionDialog({
  promotion: p,
  onClose,
  onDone,
}: {
  promotion: Promotion;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const reasons = useReasons(p.org_id);
  const errText = usePreflightText();
  const [decision, setDecision] = useState<DecisionKind>("approve");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [condition, setCondition] = useState("");
  const [comment, setComment] = useState("");
  const needsReasons = decision === "reject" || decision === "request_changes";
  const otherPicked = (reasons.data ?? []).some((r) => r.is_other && picked.includes(r.id));
  const invalid =
    (needsReasons && !picked.length && !other.trim()) ||
    (otherPicked && !other.trim()) ||
    (decision === "conditional_approve" && !condition.trim());
  const decide = useMutation({
    mutationFn: () =>
      decidePromotion(p.id, {
        decision,
        reasonIds: needsReasons ? picked : [],
        reasonOther: other,
        condition,
        comment,
      }),
    onSuccess: () => {
      toast.success(t("review.decidedToast"));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("review.decisionTitle")}
      description={t("review.humanDecisionNote")}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={decide.isPending} disabled={invalid} onClick={() => decide.mutate()}>
            {t("review.confirmDecision")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="decision-dialog">
        <Field label={t("review.decisionChoice")}>
          <Select value={decision} onChange={(e) => setDecision(e.target.value as DecisionKind)}>
            {DECISIONS.map((d) => (
              <option key={d} value={d}>
                {t(`review.decision.${d}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        {needsReasons && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">{t("review.reasons")}</legend>
            {(reasons.data ?? []).map((r) => (
              <Checkbox
                key={r.id}
                label={lang === "en" ? r.label_en : r.label_ar}
                checked={picked.includes(r.id)}
                onChange={(e) =>
                  setPicked((x) => (e.target.checked ? [...x, r.id] : x.filter((y) => y !== r.id)))
                }
              />
            ))}
          </fieldset>
        )}
        {(otherPicked || (needsReasons && !picked.length)) && (
          <Field label={t("review.reasonOther")}>
            <Input value={other} onChange={(e) => setOther(e.target.value)} dir="auto" />
          </Field>
        )}
        {decision === "conditional_approve" && (
          <Field label={t("review.condition")}>
            <Textarea
              rows={2}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              dir="auto"
            />
          </Field>
        )}
        <Field label={t("review.comment")} optional optionalLabel={t("common.optional")}>
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            dir="auto"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function EscalateDialog({
  promotion: p,
  onClose,
  onDone,
}: {
  promotion: Promotion;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const members = useMembers(p.org_id);
  const legal = (members.data ?? []).filter((m) => m.role === "legal");
  const [user, setUser] = useState("");
  const [question, setQuestion] = useState("");
  const errText = usePreflightText();
  const run = useMutation({
    mutationFn: () => escalatePromotion(p.id, user, question),
    onSuccess: () => {
      toast.success(t("review.escalatedToast"));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("review.escalate")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={run.isPending}
            disabled={!user || !question.trim()}
            onClick={() => run.mutate()}
          >
            {t("review.escalate")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {legal.length === 0 && !members.isPending ? (
          <p className="text-sm text-fg-muted">{t("review.noLegalMembers")}</p>
        ) : (
          <Field label={t("review.legalMember")}>
            <Select value={user} onChange={(e) => setUser(e.target.value)}>
              <option value="">—</option>
              {legal.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || m.email || m.user_id}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("review.question")}>
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            dir="auto"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function TextActionDialog({
  title,
  label,
  run,
  toastKey,
  onClose,
  onDone,
}: {
  title: string;
  label: string;
  run: (text: string) => Promise<void>;
  toastKey: TKey;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const errText = usePreflightText();
  const m = useMutation({
    mutationFn: () => run(text),
    onSuccess: () => {
      toast.success(t(toastKey));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
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
          <Button loading={m.isPending} disabled={!text.trim()} onClick={() => m.mutate()}>
            {t("common.confirm")}
          </Button>
        </>
      }
    >
      <Field label={label}>
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
      </Field>
    </Dialog>
  );
}
