// Conditional approval workspace (V2 upgrade §15, D175). Marketer: answer each condition, attach evidence links or
// files, then «إرسال الشروط للتحقق» (no new analysis — the content did not change). Reviewer: verify each condition,
// ask for more evidence or reject the fulfilment, then record the final approval as a separate decision.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileUp, ListChecks, Send } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Field, Textarea, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { supabase } from "@/lib/supabase";
import { pk, type Promotion } from "@/lib/api/promotions";
import {
  fetchConditions,
  finalizeConditional,
  rk,
  saveConditionResponse,
  submitConditions,
  verifyCondition,
  type ApprovalCondition,
} from "@/lib/api/review";
import { usePreflightText } from "./model";

export function ConditionsPanel({
  promotion: p,
  orgRole,
  userId,
  isOwner,
  uploaderId,
  people,
}: {
  promotion: Promotion;
  orgRole: string | null;
  userId: string | null;
  isOwner: boolean;
  uploaderId: string | null;
  people?: Record<string, { name: string; role: string }>;
}) {
  const { t, formatDate } = useI18n();
  const qc = useQueryClient();
  const errText = usePreflightText();
  const conditions = useQuery({
    queryKey: rk.conditions(p.id),
    queryFn: () => fetchConditions(p.id),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: rk.conditions(p.id) });
    void qc.invalidateQueries({ queryKey: pk.promotion(p.id) });
    void qc.invalidateQueries({ queryKey: rk.history(p.id) });
  };
  const all = conditions.data ?? [];
  if (!all.length) return null;
  // The latest conditional decision's conditions; older ones stay in the history.
  const latestDecision = all.at(-1)!.decision_id;
  const current = all.filter((c) => c.decision_id === latestDecision);
  const appliesToCurrent = current[0]?.submission_id === p.current_version_id;
  const active = p.review_status === "conditionally_approved" && appliesToCurrent;
  const role = orgRole ?? "";
  const uploaderSide =
    active &&
    (isOwner ||
      uploaderId === userId ||
      ["owner", "admin", "creator", "external_uploader"].includes(role)) &&
    !["viewer", "legal", "external_reviewer"].includes(role);
  const decider =
    active &&
    ["owner", "admin", "reviewer", "compliance_lead"].includes(role) &&
    uploaderId !== userId &&
    (role !== "reviewer" || p.assigned_reviewer_id === userId);
  const allVerified = current.every((c) => c.status === "verified");
  const readyToSubmit = current.some((c) =>
    ["open", "more_evidence", "rejected"].includes(c.status),
  );

  return (
    <Card className="flex flex-col gap-4" data-testid="conditions-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ListChecks aria-hidden="true" className="size-5" />
            {t("ws.cond.title")}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {active
              ? t("ws.cond.subtitle")
              : appliesToCurrent
                ? t("ws.cond.closed")
                : t("ws.cond.newVersionNote")}
          </p>
        </div>
        <Badge variant="outline">
          {t("ws.cond.progress", {
            done: current.filter((c) => c.status === "verified").length,
            total: current.length,
          })}
        </Badge>
      </div>
      <ol className="flex flex-col gap-3">
        {current.map((c) => (
          <ConditionItem
            key={c.id}
            c={c}
            uploaderSide={uploaderSide}
            decider={decider}
            people={people}
            onDone={refresh}
          />
        ))}
      </ol>
      {uploaderSide && readyToSubmit && (
        <SubmitConditions
          pid={p.id}
          disabled={current.some(
            (c) => ["open", "more_evidence", "rejected"].includes(c.status) && !c.fulfillment_note,
          )}
          onDone={refresh}
        />
      )}
      {decider && <FinalApproval pid={p.id} allVerified={allVerified} onDone={refresh} />}
      <p className="text-xs text-fg-muted">
        {t("ws.cond.governance", { date: formatDate(current[0]!.created_at) })}
      </p>
      {conditions.isError && (
        <p role="alert" className="text-sm text-red">
          {errText(conditions.error)}
        </p>
      )}
    </Card>
  );
}

function ConditionItem({
  c,
  uploaderSide,
  decider,
  people,
  onDone,
}: {
  c: ApprovalCondition;
  uploaderSide: boolean;
  decider: boolean;
  people?: Record<string, { name: string; role: string }>;
  onDone: () => void;
}) {
  const { t, formatDate } = useI18n();
  const errText = usePreflightText();
  const [note, setNote] = useState(c.fulfillment_note ?? "");
  const [links, setLinks] = useState((c.evidence_links ?? []).join("\n"));
  const [paths, setPaths] = useState<string[]>(c.evidence_paths ?? []);
  const [verifierNote, setVerifierNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const editable = uploaderSide && ["open", "more_evidence", "rejected"].includes(c.status);
  const save = useMutation({
    mutationFn: () =>
      saveConditionResponse(
        c.id,
        note,
        links
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        paths,
      ),
    onSuccess: () => {
      toast.success(t("ws.cond.savedToast"));
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const verify = useMutation({
    mutationFn: (v: "verified" | "more_evidence" | "rejected") =>
      verifyCondition(c.id, v, verifierNote),
    onSuccess: () => {
      toast.success(t("ws.cond.verifiedToast"));
      setVerifierNote("");
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { data: p } = await supabase
        .from("promotions")
        .select("org_id")
        .eq("id", c.promotion_id)
        .single();
      const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
      const path = `${p!.org_id}/conditions/${c.promotion_id}/${c.id}-${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("evidence")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      setPaths((x) => [...x, path]);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setUploading(false);
    }
  };
  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3" data-testid="condition">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-sm font-bold">{c.position}.</span>
        <Badge>{t(`ws.cond.status.${c.status}` as TKey)}</Badge>
        {c.evidence_required && <Badge variant="outline">{t("ws.cond.evidenceRequired")}</Badge>}
        {c.due_on && (
          <Badge variant="neutral">{t("ws.cond.due", { date: formatDate(c.due_on) })}</Badge>
        )}
        {c.responsible_user_id && people?.[c.responsible_user_id] && (
          <Badge variant="neutral">
            {t("ws.cond.responsible", { name: people[c.responsible_user_id]!.name })}
          </Badge>
        )}
      </div>
      <p className="font-medium" dir="auto">
        {c.description}
      </p>
      {c.required_action && (
        <p className="text-sm text-fg-muted" dir="auto">
          <span className="font-bold">{t("ws.cond.requiredAction")}: </span>
          {c.required_action}
        </p>
      )}
      {c.fulfillment_note && !editable && (
        <div className="rounded-md bg-sunken p-2 text-sm">
          <p className="text-xs text-fg-muted">
            {t("ws.cond.fulfilment")}
            {c.fulfilled_at ? ` · ${formatDate(c.fulfilled_at, true)}` : ""}
          </p>
          <p dir="auto">{c.fulfillment_note}</p>
          {(c.evidence_links ?? []).map((l) => (
            <a
              key={l}
              href={l}
              target="_blank"
              rel="noreferrer noopener"
              className="block truncate text-green underline-offset-4 hover:underline"
              dir="ltr"
            >
              {l}
            </a>
          ))}
          {(c.evidence_paths ?? []).map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => void openFile(x)}
              className="block text-start text-green underline-offset-4 hover:underline"
            >
              {x.split("/").at(-1)}
            </button>
          ))}
        </div>
      )}
      {c.verifier_note && (
        <p className="text-sm">
          <span className="font-bold">{t("ws.cond.verifierNote")}: </span>
          <span dir="auto">{c.verifier_note}</span>
        </p>
      )}
      {editable && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label={t("ws.cond.note")}>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              dir="auto"
              maxLength={5000}
            />
          </Field>
          <Field label={t("ws.cond.links")} optional optionalLabel={t("common.optional")}>
            <Textarea rows={2} value={links} onChange={(e) => setLinks(e.target.value)} dir="ltr" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm hover:bg-sunken">
              <FileUp aria-hidden="true" className="size-4" />
              {uploading ? t("common.loading") : t("ws.cond.attach")}
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {paths.map((x) => (
              <Badge key={x} variant="neutral">
                {x.split("/").at(-1)}
              </Badge>
            ))}
            <Button type="submit" size="sm" loading={save.isPending} disabled={!note.trim()}>
              {t("ws.cond.saveAnswer")}
            </Button>
          </div>
        </form>
      )}
      {decider && c.status === "submitted" && (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <Field
            label={t("ws.cond.verifierNote")}
            optional
            optionalLabel={t("ws.cond.noteForReturn")}
          >
            <Textarea
              rows={2}
              value={verifierNote}
              onChange={(e) => setVerifierNote(e.target.value)}
              dir="auto"
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              icon={<BadgeCheck />}
              loading={verify.isPending}
              onClick={() => verify.mutate("verified")}
            >
              {t("ws.cond.verify")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!verifierNote.trim() || verify.isPending}
              onClick={() => verify.mutate("more_evidence")}
            >
              {t("ws.cond.moreEvidence")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!verifierNote.trim() || verify.isPending}
              onClick={() => verify.mutate("rejected")}
            >
              {t("ws.cond.reject")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function SubmitConditions({
  pid,
  disabled,
  onDone,
}: {
  pid: string;
  disabled: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const m = useMutation({
    mutationFn: () => submitConditions(pid),
    onSuccess: () => {
      toast.success(t("ws.cond.submittedToast"));
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <div className="flex flex-col gap-1">
      <Button
        icon={<Send />}
        className="self-start"
        disabled={disabled}
        loading={m.isPending}
        onClick={() => m.mutate()}
      >
        {t("ws.cond.submitAll")}
      </Button>
      <p className="text-xs text-fg-muted">{t("ws.cond.submitHint")}</p>
    </div>
  );
}

function FinalApproval({
  pid,
  allVerified,
  onDone,
}: {
  pid: string;
  allVerified: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const [comment, setComment] = useState("");
  const m = useMutation({
    mutationFn: () => finalizeConditional(pid, comment),
    onSuccess: () => {
      toast.success(t("ws.cond.finalizedToast"));
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <p className="text-sm">
        {allVerified ? t("ws.cond.allVerified") : t("ws.cond.finalizeHint")}
      </p>
      {allVerified && (
        <Field label={t("ws.decide.explain")} optional optionalLabel={t("common.optional")}>
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            dir="auto"
          />
        </Field>
      )}
      <Button
        className="self-start"
        icon={<BadgeCheck />}
        disabled={!allVerified}
        loading={m.isPending}
        onClick={() => m.mutate()}
      >
        {t("ws.cond.finalize")}
      </Button>
    </div>
  );
}
