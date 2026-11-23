import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  StatusChip,
  Textarea,
  toast,
  type StatusTone,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { RejectionReasonsField } from "@/features/review/RejectionReasonsField";
import {
  canActOnStep,
  decideStep,
  fk,
  replaceFlow,
  usePresets,
  usePreview,
  type ReviewStep,
} from "@/lib/api/flows";
import type { Promotion } from "@/lib/api/promotions";
import { useMembers, useReasons } from "@/lib/api/review";

const STEP_TONE: Record<string, StatusTone> = {
  approved: "ready",
  carried_forward: "ready",
  open: "warning",
  changes_requested: "violation",
  rejected: "violation",
};

/** The live multi-level flow of a promotion: each step, who can act, and the step decision (Phase 6.1). */
export function FlowPanel({
  promotion: p,
  steps,
  orgRole,
  onDone,
}: {
  promotion: Promotion;
  steps: ReviewStep[];
  orgRole: string | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const members = useMembers(p.org_id);
  const name = (u: string) => {
    const m = (members.data ?? []).find((x) => x.user_id === u);
    return m?.display_name || m?.email || u.slice(0, 8);
  };
  const [deciding, setDeciding] = useState<ReviewStep | null>(null);
  if (!steps.length) return null;
  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-border p-3"
      data-testid="flow-panel"
    >
      <h3 className="text-sm font-bold">
        {t("flows.title")} · {t(`flows.mode.${steps[0]!.mode}` as TKey)}
      </h3>
      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              <bdi>{s.step_no}</bdi>. <span dir="auto">{s.label_ar}</span>
            </span>
            <StatusChip tone={STEP_TONE[s.status] ?? "neutral"}>
              {t(`flows.status.${s.status}` as TKey)}
            </StatusChip>
            <span className="text-fg-muted">
              {s.assignee_ids.length
                ? s.assignee_ids.map(name).join("، ")
                : s.role
                  ? t(`org.roles.${s.role}` as TKey)
                  : ""}
            </span>
            {s.decided_by && <span className="text-fg-muted">— {name(s.decided_by)}</span>}
            {s.status === "open" && <StepAction step={s} onOpen={() => setDeciding(s)} />}
          </li>
        ))}
      </ol>
      <p className="text-xs text-fg-muted">{t("flows.noConditional")}</p>
      {["owner", "admin"].includes(orgRole ?? "") &&
        ["pending_review", "in_review"].includes(p.review_status) && (
          <ReplacePreset promotion={p} onDone={onDone} />
        )}
      {deciding && (
        <StepDecisionDialog
          promotion={p}
          step={deciding}
          onClose={() => setDeciding(null)}
          onDone={onDone}
        />
      )}
    </section>
  );
}

function StepAction({ step, onOpen }: { step: ReviewStep; onOpen: () => void }) {
  const { t } = useI18n();
  const text = usePreflightText();
  const pre = useQuery({ queryKey: fk.stepCheck(step.id), queryFn: () => canActOnStep(step.id) });
  if (!pre.data) return null;
  if (!pre.data.ok)
    return pre.data.reasons.includes("forbidden") ? null : (
      <span className="text-xs text-fg-muted">{text(pre.data.reasons[0])}</span>
    );
  return (
    <Button size="sm" icon={<Gavel />} onClick={onOpen}>
      {t("flows.decideStep")}
    </Button>
  );
}

function ReplacePreset({ promotion: p, onDone }: { promotion: Promotion; onDone: () => void }) {
  const { t } = useI18n();
  const presets = usePresets(p.org_id);
  const errText = usePreflightText();
  const [preset, setPreset] = useState("");
  const run = useMutation({
    mutationFn: () => replaceFlow(p.id, preset),
    onSuccess: () => {
      toast.success(t("flows.replaced"));
      setPreset("");
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={t("flows.replace")} hint={t("flows.replaceWarning")} className="max-w-xs">
        <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="">—</option>
          {(presets.data ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        size="sm"
        variant="secondary"
        disabled={!preset}
        loading={run.isPending}
        onClick={() => window.confirm(t("flows.replaceWarning")) && run.mutate()}
      >
        {t("flows.replaceConfirm")}
      </Button>
    </div>
  );
}

function StepDecisionDialog({
  promotion: p,
  step,
  onClose,
  onDone,
}: {
  promotion: Promotion;
  step: ReviewStep;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const reasons = useReasons(p.org_id);
  const errText = usePreflightText();
  const [decision, setDecision] = useState<"approve" | "request_changes" | "reject">("approve");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [comment, setComment] = useState("");
  const [fresh, setFresh] = useState(false);
  const needsReasons = decision !== "approve";
  const otherPicked = (reasons.data ?? []).some((r) => r.is_other && picked.includes(r.id));
  const invalid =
    (needsReasons && !picked.length && !other.trim()) || (otherPicked && !other.trim());
  const run = useMutation({
    mutationFn: () =>
      decideStep(p.id, step.id, {
        decision,
        reasonIds: needsReasons ? picked : [],
        reasonOther: other,
        comment,
        freshReview: needsReasons && fresh,
      }),
    onSuccess: () => {
      toast.success(t("review.decidedToast"));
      void qc.invalidateQueries({ queryKey: fk.steps(p.id) });
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${t("flows.decideStep")} — ${step.label_ar}`}
      description={t("review.humanDecisionNote")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={run.isPending} disabled={invalid} onClick={() => run.mutate()}>
            {t("review.confirmDecision")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="step-decision-dialog">
        <Field label={t("review.decisionChoice")}>
          <Select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            {(["approve", "request_changes", "reject"] as const).map((d) => (
              <option key={d} value={d}>
                {t(`review.decision.${d}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        {needsReasons && (
          <RejectionReasonsField
            reasons={reasons.data ?? []}
            picked={picked}
            setPicked={setPicked}
            other={other}
            setOther={setOther}
          />
        )}
        {needsReasons && (
          <Checkbox
            label={t("flows.freshReview")}
            checked={fresh}
            onChange={(e) => setFresh(e.target.checked)}
          />
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

/** Inside the submit dialog: which preset applies, locked by org settings, and which approved steps to carry forward. */
export function SubmitFlowSection({
  pid,
  carry,
  setCarry,
}: {
  pid: string;
  carry: number[];
  setCarry: (c: number[]) => void;
}) {
  const { t } = useI18n();
  const pre = usePreview(pid);
  if (!pre.data?.enabled || !pre.data.preset_id) return null;
  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm"
      data-testid="submit-flow"
    >
      <p>
        {t("flows.willApply")}: <strong dir="auto">{pre.data.name}</strong> (
        {t(`flows.mode.${pre.data.mode}` as TKey)})
      </p>
      {pre.data.locked && <p className="text-fg-muted">{t("flows.locked")}</p>}
      {(pre.data.carryable ?? []).length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-medium">{t("flows.carryTitle")}</legend>
          {pre.data.carryable!.map((n) => (
            <Checkbox
              key={n}
              label={t("flows.carryStep", { n })}
              checked={carry.includes(n)}
              onChange={(e) =>
                setCarry(e.target.checked ? [...carry, n] : carry.filter((x) => x !== n))
              }
            />
          ))}
        </fieldset>
      )}
    </div>
  );
}
