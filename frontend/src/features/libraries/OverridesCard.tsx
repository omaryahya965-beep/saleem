import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Select,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import type { Rule } from "@/lib/api/data";
import { CHANNELS } from "@/lib/api/promotions";
import { archiveRuleOverride, lk, setRuleOverride, useOverrides } from "@/lib/api/libraries";
import { usePreflightText } from "@/features/review/model";
import { OrgSelect } from "./OrgSelect";
import { useOrgPicker } from "./orgPicker";

/** Org admins narrow a rule's scope with a reason (audited). They never change its logic. */
export function OverridesCard({ rules }: { rules: Rule[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const picker = useOrgPicker();
  const manager = ["owner", "admin"].includes(picker.role ?? "");
  const overrides = useOverrides(manager ? picker.orgId : null);
  const errText = usePreflightText();
  const [code, setCode] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [reason, setReason] = useState("");
  const refresh = () => void qc.invalidateQueries({ queryKey: lk.overrides(picker.orgId) });
  const save = useMutation({
    mutationFn: () =>
      setRuleOverride(
        picker.orgId,
        code,
        disabled ? { disabled: true } : { exclude_channels: channels },
        reason,
      ),
    onSuccess: () => {
      toast.success(t("overrides.saved"));
      setCode("");
      setChannels([]);
      setDisabled(false);
      setReason("");
      refresh();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const archive = useMutation({
    mutationFn: archiveRuleOverride,
    onSuccess: refresh,
    onError: (e) => toast.error(errText(e)),
  });
  if (!manager) return null;
  const candidates = rules.filter((r) => !r.code.startsWith("SYS-") && r.check_kind !== "workflow");
  return (
    <Card className="flex flex-col gap-3" data-testid="overrides-card">
      <CardTitle>{t("overrides.title")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("overrides.subtitle")}</p>
      <OrgSelect picker={picker} />
      {(overrides.data ?? []).length > 0 && (
        <ul className="flex flex-col gap-2 text-sm">
          {overrides.data!.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <Badge mono>{o.rule_code}</Badge> {JSON.stringify(o.applicability_patch)} —{" "}
                <span dir="auto">{o.reason}</span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => archive.mutate(o.id)}>
                {t("overrides.remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("overrides.rule")}>
          <Select value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">—</option>
            {candidates.map((r) => (
              <option key={r.id} value={r.code}>
                {r.code} · {r.title_ar}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("overrides.reason")}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} dir="auto" />
        </Field>
      </div>
      <Checkbox
        label={t("overrides.disable")}
        checked={disabled}
        onChange={(e) => setDisabled(e.target.checked)}
      />
      {!disabled && (
        <fieldset className="flex flex-wrap gap-x-4">
          <legend className="mb-1 text-sm font-medium">{t("overrides.excludeChannels")}</legend>
          {CHANNELS.map((c) => (
            <Checkbox
              key={c}
              label={t(`promo.channel.${c}` as TKey)}
              checked={channels.includes(c)}
              onChange={(e) =>
                setChannels((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))
              }
            />
          ))}
        </fieldset>
      )}
      <Button
        className="self-end"
        disabled={!code || reason.trim().length < 3 || (!disabled && !channels.length)}
        loading={save.isPending}
        onClick={() => save.mutate()}
      >
        {t("common.save")}
      </Button>
    </Card>
  );
}
