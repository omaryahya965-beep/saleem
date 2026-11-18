import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
import { usePreflightText } from "@/features/review/model";
import {
  archivePreset,
  flagOn,
  fk,
  savePreset,
  setAutoApply,
  useAutoApply,
  usePresets,
  type ApprovalPreset,
  type StepInput,
} from "@/lib/api/flows";
import { PRODUCT_TYPES, useOrgSettings } from "@/lib/api/promotions";
import { useMembers } from "@/lib/api/review";
import { getEnabledRoles } from "@/lib/roleConfig";
import type { OrgRole } from "@/lib/permissions";

const ALL_STEP_ROLES: OrgRole[] = ["reviewer", "compliance_lead", "legal", "admin", "owner"];
const blankStep = (): StepInput => ({ role: "reviewer", user_ids: [], label_ar: "" });

/** Approval presets (sequential / parallel), the default preset and auto-apply by market + product type (Phase 6.1). */
export function PresetsCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const presets = usePresets(orgId);
  const auto = useAutoApply(orgId);
  const members = useMembers(orgId);
  const enabledRoles = getEnabledRoles(
    (settings.data?.features as Record<string, unknown> | null) ?? null,
  );
  const availableStepRoles = ALL_STEP_ROLES.filter((r) => enabledRoles.includes(r));
  const errText = usePreflightText();
  const [editing, setEditing] = useState<{
    id: string | null;
    name: string;
    mode: string;
    isDefault: boolean;
    steps: StepInput[];
  } | null>(null);
  const [market, setMarket] = useState("SA");
  const [ptype, setPtype] = useState("");
  const [autoPreset, setAutoPreset] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: fk.presets(orgId) });
    void qc.invalidateQueries({ queryKey: fk.autoApply(orgId) });
  };
  const save = useMutation({
    mutationFn: () => savePreset({ org: orgId, ...editing! }),
    onSuccess: () => {
      toast.success(t("flows.presetSaved"));
      setEditing(null);
      refresh();
    },
    onError: (e) => toast.error(errText(e)),
  });
  const archive = useMutation({
    mutationFn: archivePreset,
    onSuccess: refresh,
    onError: (e) => toast.error(errText(e)),
  });
  const applyRule = useMutation({
    mutationFn: (i: { market: string; ptype: string; preset: string | null }) =>
      setAutoApply(orgId, i.market, i.ptype || null, i.preset),
    onSuccess: () => {
      toast.success(t("flows.autoSaved"));
      setAutoPreset("");
      refresh();
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!flagOn(settings.data?.features, "multi_level_approval")) return null;
  const reviewers = (members.data ?? []).filter((m) =>
    ["owner", "admin", "reviewer"].includes(m.role),
  );
  const edit = (p: ApprovalPreset) =>
    setEditing({
      id: p.id,
      name: p.name,
      mode: p.mode,
      isDefault: p.is_default,
      steps: [...p.approval_preset_steps]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ role: s.role, user_ids: s.user_ids, label_ar: s.label_ar })),
    });
  const setStep = (i: number, patch: Partial<StepInput>) =>
    setEditing((e) =>
      e ? { ...e, steps: e.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : e,
    );
  const nameOf = (id: string) => (presets.data ?? []).find((p) => p.id === id)?.name ?? "—";

  return (
    <Card className="flex flex-col gap-4" data-testid="presets-card">
      <CardTitle>{t("flows.presetsTitle")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("flows.presetsSubtitle")}</p>
      <ul className="flex flex-col gap-2 text-sm">
        {(presets.data ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2">
            <strong dir="auto">{p.name}</strong>
            <Badge>{t(`flows.mode.${p.mode}` as TKey)}</Badge>
            {p.is_default && <Badge variant="green">{t("flows.default")}</Badge>}
            <span className="text-fg-muted">
              {t("flows.stepsCount", { n: p.approval_preset_steps.length })}
            </span>
            <Button size="sm" variant="secondary" onClick={() => edit(p)}>
              {t("products.edit")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => archive.mutate(p.id)}>
              {t("flows.archive")}
            </Button>
          </li>
        ))}
      </ul>
      {!editing && (
        <Button
          className="self-start"
          icon={<Plus />}
          onClick={() =>
            setEditing({
              id: null,
              name: "",
              mode: "sequential",
              isDefault: !(presets.data ?? []).length,
              steps: [blankStep()],
            })
          }
        >
          {t("flows.newPreset")}
        </Button>
      )}
      {editing && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("flows.presetName")}>
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                dir="auto"
              />
            </Field>
            <Field label={t("flows.modeLabel")}>
              <Select
                value={editing.mode}
                onChange={(e) => setEditing({ ...editing, mode: e.target.value })}
              >
                <option value="sequential">{t("flows.mode.sequential")}</option>
                <option value="parallel">{t("flows.mode.parallel")}</option>
              </Select>
            </Field>
          </div>
          <Checkbox
            label={t("flows.makeDefault")}
            checked={editing.isDefault}
            onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
          />
          <ol className="flex flex-col gap-2">
            {editing.steps.map((s, i) => (
              <li key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Field label={t("flows.stepLabel", { n: i + 1 })}>
                  <Input
                    value={s.label_ar}
                    onChange={(e) => setStep(i, { label_ar: e.target.value })}
                    dir="auto"
                  />
                </Field>
                <Field label={t("flows.stepRole")}>
                  <Select
                    value={s.user_ids.length ? "" : (s.role ?? "")}
                    onChange={(e) => setStep(i, { role: e.target.value || null, user_ids: [] })}
                  >
                    <option value="">—</option>
                    {availableStepRoles.map((r) => (
                      <option key={r} value={r}>
                        {t(`org.roles.${r}` as TKey)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("flows.stepUser")}>
                  <Select
                    value={s.user_ids[0] ?? ""}
                    onChange={(e) =>
                      setStep(
                        i,
                        e.target.value
                          ? { user_ids: [e.target.value], role: null }
                          : { user_ids: [], role: "reviewer" },
                      )
                    }
                  >
                    <option value="">—</option>
                    {reviewers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name || m.email}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("common.delete")}
                  icon={<Trash2 />}
                  disabled={editing.steps.length < 2}
                  onClick={() =>
                    setEditing({ ...editing, steps: editing.steps.filter((_, j) => j !== i) })
                  }
                />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Plus />}
              disabled={editing.steps.length >= 10}
              onClick={() => setEditing({ ...editing, steps: [...editing.steps, blankStep()] })}
            >
              {t("flows.addStep")}
            </Button>
            <span className="flex-1" />
            <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              loading={save.isPending}
              disabled={
                !editing.name.trim() || editing.steps.some((s) => !s.role && !s.user_ids.length)
              }
              onClick={() => save.mutate()}
            >
              {t("common.save")}
            </Button>
          </div>
          {editing.id && <p className="text-xs text-fg-muted">{t("flows.editNote")}</p>}
        </div>
      )}

      <h3 className="text-sm font-bold">{t("flows.autoTitle")}</h3>
      <ul className="flex flex-col gap-1 text-sm">
        {(auto.data ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2">
            <Badge mono>{a.market}</Badge>
            <span>
              {a.product_type
                ? t(`products.typeOpt.${a.product_type}` as TKey)
                : t("flows.anyProduct")}
            </span>
            <span>
              → <strong dir="auto">{nameOf(a.preset_id)}</strong>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                applyRule.mutate({ market: a.market, ptype: a.product_type ?? "", preset: null })
              }
            >
              {t("overrides.remove")}
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid items-end gap-2 sm:grid-cols-[8rem_1fr_1fr_auto]">
        <Field label={t("flows.market")}>
          <Input
            value={market}
            onChange={(e) => setMarket(e.target.value.toUpperCase())}
            maxLength={2}
          />
        </Field>
        <Field label={t("flows.productType")}>
          <Select value={ptype} onChange={(e) => setPtype(e.target.value)}>
            <option value="">{t("flows.anyProduct")}</option>
            {PRODUCT_TYPES.map((p) => (
              <option key={p} value={p}>
                {t(`products.typeOpt.${p}` as TKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("flows.preset")}>
          <Select value={autoPreset} onChange={(e) => setAutoPreset(e.target.value)}>
            <option value="">—</option>
            {(presets.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          size="sm"
          disabled={!autoPreset || market.length !== 2}
          loading={applyRule.isPending}
          onClick={() => applyRule.mutate({ market, ptype, preset: autoPreset })}
        >
          {t("common.save")}
        </Button>
      </div>
    </Card>
  );
}
