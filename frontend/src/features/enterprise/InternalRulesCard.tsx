import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Field,
  Input,
  Select,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { flagOn } from "@/lib/api/flows";
import {
  approveInternalRule,
  archiveInternalRule,
  draftRules,
  ik,
  saveGuideline,
  saveInternalRule,
  useGuidelines,
  useInternalRules,
  type InternalRule,
} from "@/lib/api/internalRules";
import { useOrgSettings } from "@/lib/api/promotions";
import { useAuth } from "@/lib/api/auth";

type Edit = {
  id: string | null;
  code: string;
  title: string;
  instruction: string;
  severity: string;
};

/** Brand guidelines → drafted internal rules → a person edits and approves each (Phase 6.7). «سياسة داخلية». */
export function InternalRulesCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const rules = useInternalRules(orgId);
  const guidelines = useGuidelines(orgId);
  const errText = usePreflightText();
  const [gTitle, setGTitle] = useState("");
  const [gText, setGText] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ik.rules(orgId) });
    void qc.invalidateQueries({ queryKey: ik.guidelines(orgId) });
  };
  const onError = (e: unknown) => toast.error(errText(e));
  const addGuideline = useMutation({
    mutationFn: () => saveGuideline(orgId, gTitle, gText),
    onSuccess: () => {
      setGTitle("");
      setGText("");
      refresh();
    },
    onError,
  });
  const draft = useMutation({
    mutationFn: (g: string) => draftRules(orgId, g),
    onSuccess: (r) => {
      toast.success(
        t(
          r.source === "model_draft"
            ? "internalRules.draftedModel"
            : "internalRules.draftedHeuristic",
          { n: r.drafted },
        ),
      );
      refresh();
    },
    onError: () => toast.error(t("internalRules.draftFailed")),
  });
  const save = useMutation({
    mutationFn: () => saveInternalRule(orgId, edit!),
    onSuccess: () => {
      setEdit(null);
      refresh();
    },
    onError,
  });
  const approve = useMutation({ mutationFn: approveInternalRule, onSuccess: refresh, onError });
  const archive = useMutation({ mutationFn: archiveInternalRule, onSuccess: refresh, onError });
  if (!flagOn(settings.data?.features, "internal_rules")) return null;
  const open = (r: InternalRule) =>
    setEdit({
      id: r.id,
      code: r.code,
      title: r.title_ar,
      instruction: r.instruction_ar,
      severity: r.severity,
    });

  return (
    <Card className="flex flex-col gap-4" data-testid="internal-rules">
      <CardTitle>{t("internalRules.title")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("internalRules.subtitle")}</p>

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <h3 className="text-sm font-bold">{t("internalRules.guidelines")}</h3>
        <ul className="flex flex-col gap-1 text-sm">
          {(guidelines.data ?? []).map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              <span dir="auto">{g.title}</span>
              <Button
                size="sm"
                variant="secondary"
                icon={<Sparkles />}
                loading={draft.isPending}
                onClick={() => draft.mutate(g.id)}
              >
                {t("internalRules.draft")}
              </Button>
            </li>
          ))}
        </ul>
        <Field label={t("internalRules.guidelineTitle")}>
          <Input value={gTitle} onChange={(e) => setGTitle(e.target.value)} dir="auto" />
        </Field>
        <Field label={t("internalRules.guidelineText")} hint={t("internalRules.guidelineHint")}>
          <Textarea rows={5} value={gText} onChange={(e) => setGText(e.target.value)} dir="auto" />
        </Field>
        <Button
          size="sm"
          className="self-start"
          disabled={!gText.trim()}
          loading={addGuideline.isPending}
          onClick={() => addGuideline.mutate()}
        >
          {t("internalRules.addGuideline")}
        </Button>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {(rules.data ?? []).map((r) => (
          <li key={r.id} className="flex flex-col gap-1 rounded-md border border-border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge mono>{r.code}</Badge>
              <strong dir="auto">{r.title_ar}</strong>
              <Badge variant={r.status === "active" ? "green" : "neutral"}>
                {t(`internalRules.status.${r.status}` as TKey)}
              </Badge>
              <Badge variant="outline">{t(`internalRules.source.${r.source}` as TKey)}</Badge>
              <Badge variant="outline">{t("companyRules.version", { n: r.version })}</Badge>
              <Badge variant="neutral">{t("companyRules.internalPolicy")}</Badge>
            </div>
            <p className="text-fg-muted" dir="auto">
              {r.instruction_ar}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => open(r)}>
                {t("products.edit")}
              </Button>
              {r.status === "draft" && (
                <Button
                  size="sm"
                  disabled={!r.edited_by || r.edited_by === user?.id}
                  loading={approve.isPending}
                  onClick={() => approve.mutate(r.id)}
                >
                  {t("internalRules.approve")}
                </Button>
              )}
              {r.status === "draft" && !r.edited_by && (
                <span className="text-xs text-fg-muted">{t("internalRules.editFirst")}</span>
              )}
              {r.status === "draft" && r.edited_by && r.edited_by === user?.id && (
                <span className="text-xs text-fg-muted" data-testid="author-cannot-approve">
                  {t("companyRules.authorCannotApprove")}
                </span>
              )}
              <Button size="sm" variant="ghost" onClick={() => archive.mutate(r.id)}>
                {t("flows.archive")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!edit ? (
        <Button
          className="self-start"
          variant="secondary"
          icon={<Plus />}
          onClick={() =>
            setEdit({ id: null, code: "INT-", title: "", instruction: "", severity: "warning" })
          }
        >
          {t("internalRules.add")}
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr_10rem]">
            <Field label={t("internalRules.code")}>
              <Input
                value={edit.code}
                onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                dir="ltr"
              />
            </Field>
            <Field label={t("internalRules.ruleTitle")}>
              <Input
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                dir="auto"
              />
            </Field>
            <Field label={t("internalRules.severity")}>
              <Select
                value={edit.severity}
                onChange={(e) => setEdit({ ...edit, severity: e.target.value })}
              >
                <option value="warning">{t("internalRules.sev.warning")}</option>
                <option value="violation">{t("internalRules.sev.violation")}</option>
              </Select>
            </Field>
          </div>
          <Field label={t("internalRules.instruction")}>
            <Textarea
              rows={2}
              value={edit.instruction}
              onChange={(e) => setEdit({ ...edit, instruction: e.target.value })}
              dir="auto"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEdit(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={
                !/^INT-[A-Z0-9-]{2,24}$/.test(edit.code) ||
                !edit.title.trim() ||
                !edit.instruction.trim()
              }
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
