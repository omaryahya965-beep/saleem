import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import {
  canSelfApprove,
  flagOn,
  saveSelfApprovalRule,
  selfApprove,
  useSelfApprovalRules,
} from "@/lib/api/flows";
import { CHANNELS, useOrgSettings, type Promotion } from "@/lib/api/promotions";

/** Uploader's «اعتماد ذاتي» when an org rule allows it (Phase 7.1). Re-checked by the server at click time. */
export function SelfApproveAction({
  promotion: p,
  uploadedIt,
  onDone,
}: {
  promotion: Promotion;
  uploadedIt: boolean;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const settings = useOrgSettings(p.org_id);
  const on = flagOn(settings.data?.features, "self_approval");
  const pre = useQuery({
    queryKey: ["can-self-approve", p.id, p.review_status],
    queryFn: () => canSelfApprove(p.id),
    enabled: on && uploadedIt && p.review_status === "pending_review",
  });
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const run = useMutation({
    mutationFn: () => selfApprove(p.id, comment),
    onSuccess: () => {
      toast.success(t("selfApproval.done"));
      setOpen(false);
      onDone();
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!pre.data?.ok) return null;
  return (
    <>
      <Button variant="secondary" icon={<BadgeCheck />} onClick={() => setOpen(true)}>
        {t("selfApproval.action")}
      </Button>
      {open && (
        <Dialog
          open
          onOpenChange={(o) => !o && setOpen(false)}
          title={t("selfApproval.action")}
          description={t("selfApproval.note")}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button loading={run.isPending} onClick={() => run.mutate()}>
                {t("review.confirmDecision")}
              </Button>
            </>
          }
        >
          <Field label={t("review.comment")} optional optionalLabel={t("common.optional")}>
            <Textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              dir="auto"
            />
          </Field>
        </Dialog>
      )}
    </>
  );
}

/** Owners/admins define who may self-approve, where, and the minimum AI requirement. */
export function SelfApprovalRulesCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const rules = useSelfApprovalRules(orgId);
  const errText = usePreflightText();
  const [name, setName] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>(["creator"]);
  const [market, setMarket] = useState("SA");
  const [ai, setAi] = useState("no_findings");
  const save = useMutation({
    mutationFn: () =>
      saveSelfApprovalRule(orgId, { name, channels, markets: market ? [market] : [], roles, ai }),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: ["self-approval-rules", orgId] });
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!flagOn(settings.data?.features, "self_approval")) return null;
  const toggle = (a: string[], v: string, on: boolean) =>
    on ? [...a, v] : a.filter((x) => x !== v);
  return (
    <Card className="flex flex-col gap-3" data-testid="self-approval-rules">
      <CardTitle>{t("selfApproval.rulesTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("selfApproval.rulesSubtitle")}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {(rules.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2">
            <strong dir="auto">{r.name}</strong>
            <Badge>{t(`selfApproval.ai.${r.ai_requirement}` as TKey)}</Badge>
            <span className="text-fg-muted">
              {r.roles.map((x) => t(`org.roles.${x}` as TKey)).join("، ")} ·{" "}
              {r.channels.length
                ? r.channels.map((c) => t(`promo.channel.${c}` as TKey)).join("، ")
                : t("partner.allChannels")}
            </span>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("selfApproval.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
        </Field>
        <Field label={t("flows.market")}>
          <Input
            value={market}
            onChange={(e) => setMarket(e.target.value.toUpperCase())}
            maxLength={2}
          />
        </Field>
        <Field label={t("selfApproval.aiLabel")}>
          <Select value={ai} onChange={(e) => setAi(e.target.value)}>
            <option value="no_findings">{t("selfApproval.ai.no_findings")}</option>
            <option value="all_answered">{t("selfApproval.ai.all_answered")}</option>
          </Select>
        </Field>
      </div>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 text-sm font-medium">{t("selfApproval.roles")}</legend>
        {["creator", "reviewer", "admin"].map((r) => (
          <Checkbox
            key={r}
            label={t(`org.roles.${r}` as TKey)}
            checked={roles.includes(r)}
            onChange={(e) => setRoles(toggle(roles, r, e.target.checked))}
          />
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-x-4">
        <legend className="mb-1 text-sm font-medium">{t("partner.allowedChannels")}</legend>
        {CHANNELS.map((c) => (
          <Checkbox
            key={c}
            label={t(`promo.channel.${c}` as TKey)}
            checked={channels.includes(c)}
            onChange={(e) => setChannels(toggle(channels, c, e.target.checked))}
          />
        ))}
      </fieldset>
      <Button
        className="self-start"
        disabled={!name.trim() || !roles.length}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        {t("common.save")}
      </Button>
    </Card>
  );
}
