// Review decision dialog (V2 upgrade §13, D173/D175): no default decision, the version and findings summary in
// view, structured reasons for changes / rejection, explicit conditions for conditional approval, and the
// consequence spelled out before confirming. The server re-checks everything (decide_promotion).
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, FilePenLine, ListChecks, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Checkbox, Dialog, Field, Input, Textarea, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import type { Promotion, VersionSummary } from "@/lib/api/promotions";
import {
  canDecide,
  decidePromotion,
  useReasons,
  type ConditionInput,
  type DecisionKind,
} from "@/lib/api/review";
import { cn } from "@/lib/utils";
import { usePreflightText } from "./model";

const OPTIONS: { kind: DecisionKind; icon: React.ReactNode; approval: boolean }[] = [
  { kind: "approve", icon: <CheckCircle2 aria-hidden="true" />, approval: true },
  { kind: "conditional_approve", icon: <ListChecks aria-hidden="true" />, approval: true },
  { kind: "request_changes", icon: <FilePenLine aria-hidden="true" />, approval: false },
  { kind: "reject", icon: <CircleSlash aria-hidden="true" />, approval: false },
];

export interface DecisionSummary {
  violations: number;
  warnings: number;
  confirmed: number;
  resolved: number;
  evidenceNeeded: number;
}

export function DecisionDialog({
  promotion: p,
  version,
  summary,
  onClose,
  onDone,
}: {
  promotion: Promotion;
  version: VersionSummary | null;
  summary?: DecisionSummary;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, lang } = useI18n();
  const reasons = useReasons(p.org_id);
  const errText = usePreflightText();
  const pre = useQuery({
    queryKey: ["can-decide", p.id, "dialog"],
    queryFn: () => canDecide(p.id),
  });
  const [decision, setDecision] = useState<DecisionKind | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [comment, setComment] = useState("");
  const [conditions, setConditions] = useState<ConditionInput[]>([{ description: "" }]);
  const needsReasons = decision === "reject" || decision === "request_changes";
  const otherPicked = (reasons.data ?? []).some((r) => r.is_other && picked.includes(r.id));
  const approveOk = pre.data?.approveOk !== false;
  const filledConditions = conditions.filter((c) => c.description.trim());
  const invalid =
    !decision ||
    (needsReasons && !picked.length && !other.trim()) ||
    (otherPicked && !other.trim()) ||
    (decision === "conditional_approve" && filledConditions.length === 0) ||
    ((decision === "approve" || decision === "conditional_approve") && !approveOk);
  const decide = useMutation({
    mutationFn: () =>
      decidePromotion(p.id, {
        decision: decision!,
        reasonIds: needsReasons ? picked : [],
        reasonOther: needsReasons ? other : "",
        condition: "",
        comment,
        conditions: decision === "conditional_approve" ? filledConditions : [],
      }),
    onSuccess: () => {
      toast.success(t("review.decidedToast"));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const setCond = (i: number, patch: Partial<ConditionInput>) =>
    setConditions((xs) => xs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("ws.decide.title")}
      description={t("review.humanDecisionNote")}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={decide.isPending} disabled={invalid} onClick={() => decide.mutate()}>
            {t("ws.decide.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5" data-testid="decision-dialog">
        <div className="rounded-md bg-sunken p-3 text-sm">
          <p className="font-bold" dir="auto">
            {p.title}
          </p>
          <p className="mt-1 text-fg-muted">
            {t("ws.decide.version", { n: version?.version_no ?? 1 })}
            {summary &&
              ` · ${t("ws.decide.findings", { v: summary.violations, w: summary.warnings })}`}
          </p>
          {summary && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              <li>
                <Badge variant={summary.confirmed ? "outline" : "neutral"}>
                  {t("ws.decide.unresolved", { n: summary.confirmed })}
                </Badge>
              </li>
              <li>
                <Badge variant="neutral">
                  {t("ws.decide.resolvedCount", { n: summary.resolved })}
                </Badge>
              </li>
              <li>
                <Badge variant="neutral">
                  {t("ws.decide.evidenceNeeded", { n: summary.evidenceNeeded })}
                </Badge>
              </li>
            </ul>
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{t("ws.decide.pick")}</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup">
            {OPTIONS.map((o) => {
              const blocked = o.approval && !approveOk;
              const active = decision === o.kind;
              return (
                <button
                  key={o.kind}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={blocked}
                  onClick={() => setDecision(o.kind)}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 text-start transition-colors [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0",
                    active ? "border-ink bg-sunken" : "border-border hover:bg-sunken",
                    blocked && "cursor-not-allowed opacity-50",
                  )}
                >
                  {o.icon}
                  <span>
                    <span className="block font-bold">
                      {t(`review.decision.${o.kind}` as TKey)}
                    </span>
                    <span className="block text-xs text-fg-muted">
                      {t(`ws.decide.consequence.${o.kind}` as TKey)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {!decision && <p className="text-xs text-fg-muted">{t("ws.decide.none")}</p>}
          {!approveOk && (
            <div
              role="status"
              className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm"
            >
              <p className="font-bold text-amber-text">{t("ws.decide.blockers")}</p>
              <ul className="mt-1 list-inside list-disc">
                {(pre.data?.approveBlockers ?? []).map((r) => (
                  <li key={r}>{errText(r)}</li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>

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
            {(otherPicked || !picked.length) && (
              <Field label={t("review.reasonOther")} className="mt-2">
                <Input value={other} onChange={(e) => setOther(e.target.value)} dir="auto" />
              </Field>
            )}
          </fieldset>
        )}

        {decision === "conditional_approve" && (
          <fieldset className="flex flex-col gap-3" data-testid="conditions-editor">
            <legend className="mb-1 text-sm font-medium">{t("ws.decide.conditions")}</legend>
            {conditions.map((c, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">
                    {t("ws.decide.conditionN", { n: i + 1 })}
                  </span>
                  {conditions.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      onClick={() => setConditions((xs) => xs.filter((_, j) => j !== i))}
                    >
                      {t("ws.decide.removeCondition")}
                    </Button>
                  )}
                </div>
                <Field label={t("ws.decide.conditionDesc")}>
                  <Textarea
                    rows={2}
                    value={c.description}
                    maxLength={2000}
                    onChange={(e) => setCond(i, { description: e.target.value })}
                    dir="auto"
                  />
                </Field>
                <Field
                  label={t("ws.decide.conditionAction")}
                  optional
                  optionalLabel={t("common.optional")}
                >
                  <Input
                    value={c.requiredAction ?? ""}
                    onChange={(e) => setCond(i, { requiredAction: e.target.value })}
                    dir="auto"
                  />
                </Field>
                <div className="flex flex-wrap items-end gap-4">
                  <Checkbox
                    label={t("ws.decide.conditionEvidence")}
                    checked={Boolean(c.evidenceRequired)}
                    onChange={(e) => setCond(i, { evidenceRequired: e.target.checked })}
                  />
                  <Field
                    label={t("ws.decide.conditionDue")}
                    optional
                    optionalLabel={t("common.optional")}
                  >
                    <Input
                      type="date"
                      value={c.dueOn ?? ""}
                      onChange={(e) => setCond(i, { dueOn: e.target.value || null })}
                    />
                  </Field>
                </div>
              </div>
            ))}
            {conditions.length < 20 && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus />}
                className="self-start"
                onClick={() => setConditions((xs) => [...xs, { description: "" }])}
              >
                {t("ws.decide.addCondition")}
              </Button>
            )}
          </fieldset>
        )}

        <Field
          label={t("ws.decide.explain")}
          optional={!needsReasons}
          optionalLabel={t("common.optional")}
        >
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            dir="auto"
          />
        </Field>

        {decision && (
          <p role="note" className="rounded-md border border-border px-3 py-2 text-sm">
            <span className="font-bold">{t("ws.decide.whatHappens")}: </span>
            {t(`ws.decide.consequence.${decision}` as TKey)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
