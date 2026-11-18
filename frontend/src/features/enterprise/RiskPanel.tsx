import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import {
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { decideRisk, flagOn, requestRisk, setRiskAcceptor } from "@/lib/api/flows";
import { useOrgSettings, type Promotion } from "@/lib/api/promotions";
import { rk, useMembers } from "@/lib/api/review";

/** Risk acceptance on a promotion (Phase 6.2). Always labelled as not a compliance approval. */
export function RiskPanel({
  promotion: p,
  me,
  isUploader,
  onDone,
}: {
  promotion: Promotion;
  me: string | null;
  isUploader: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const settings = useOrgSettings(p.org_id);
  const [dialog, setDialog] = useState<null | "request" | "decide">(null);
  const on = flagOn(settings.data?.features, "risk_acceptance");
  const s = p.review_status;
  const canRequest = on && isUploader && (s === "rejected" || s === "changes_requested");
  const canDecide = s === "reviewing_risk" && p.risk_acceptor_id === me;
  if (!canRequest && !canDecide && s !== "risk_accepted" && s !== "reviewing_risk") return null;
  return (
    <div className="flex flex-col gap-2" data-testid="risk-panel">
      {(s === "risk_accepted" || s === "reviewing_risk") && (
        <p className="rounded-md border border-amber/30 bg-amber-bg px-3 py-2 text-sm font-medium text-amber-text">
          {t("risk.notApproval")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {canRequest && (
          <Button variant="secondary" icon={<ShieldAlert />} onClick={() => setDialog("request")}>
            {t("risk.request")}
          </Button>
        )}
        {canDecide && (
          <Button icon={<ShieldAlert />} onClick={() => setDialog("decide")}>
            {t("risk.decide")}
          </Button>
        )}
      </div>
      {dialog === "request" && (
        <RequestDialog promotion={p} onClose={() => setDialog(null)} onDone={onDone} />
      )}
      {dialog === "decide" && (
        <DecideDialog promotion={p} onClose={() => setDialog(null)} onDone={onDone} />
      )}
    </div>
  );
}

function RequestDialog({
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
  const errText = usePreflightText();
  const [acceptor, setAcceptor] = useState("");
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => requestRisk(p.id, acceptor, reason),
    onSuccess: () => {
      toast.success(t("risk.requested"));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const acceptors = (members.data ?? []).filter((m) => m.can_accept_risk);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("risk.request")}
      description={t("risk.notApproval")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!acceptor || !reason.trim()}
            loading={run.isPending}
            onClick={() => run.mutate()}
          >
            {t("risk.send")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t("risk.acceptor")}
          hint={!acceptors.length ? t("risk.noAcceptors") : undefined}
        >
          <Select value={acceptor} onChange={(e) => setAcceptor(e.target.value)}>
            <option value="">—</option>
            {acceptors.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name || m.email}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("risk.reason")}>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            dir="auto"
          />
        </Field>
      </div>
    </Dialog>
  );
}

function DecideDialog({
  promotion: p,
  onClose,
  onDone,
}: {
  promotion: Promotion;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: (accept: boolean) => decideRisk(p.id, accept, reason),
    onSuccess: () => {
      toast.success(t("risk.decided"));
      onDone();
      onClose();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("risk.decide")}
      description={t("risk.notApproval")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="secondary"
            disabled={!reason.trim()}
            loading={run.isPending}
            onClick={() => run.mutate(false)}
          >
            {t("risk.decline")}
          </Button>
          <Button
            disabled={!reason.trim()}
            loading={run.isPending}
            onClick={() => run.mutate(true)}
          >
            {t("risk.accept")}
          </Button>
        </>
      }
    >
      <Field label={t("risk.reason")}>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" />
      </Field>
    </Dialog>
  );
}

/** Owners/admins choose who may accept risk. */
export function RiskAcceptorsCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const members = useMembers(orgId);
  const errText = usePreflightText();
  const run = useMutation({
    mutationFn: (i: { user: string; on: boolean }) => setRiskAcceptor(orgId, i.user, i.on),
    onSuccess: () => void qc.invalidateQueries({ queryKey: rk.members(orgId) }),
    onError: (e) => toast.error(errText(e)),
  });
  if (!flagOn(settings.data?.features, "risk_acceptance")) return null;
  const eligible = (members.data ?? []).filter((m) =>
    ["owner", "admin", "reviewer", "legal"].includes(m.role),
  );
  return (
    <Card className="flex flex-col gap-3" data-testid="risk-acceptors">
      <CardTitle>{t("risk.acceptorsTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("risk.notApproval")}</p>
      {eligible.map((m) => (
        <Checkbox
          key={m.user_id}
          label={m.display_name || m.email || m.user_id}
          checked={m.can_accept_risk}
          disabled={run.isPending}
          onChange={(e) => run.mutate({ user: m.user_id, on: e.target.checked })}
        />
      ))}
    </Card>
  );
}
