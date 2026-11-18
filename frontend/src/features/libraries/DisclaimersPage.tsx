import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileCheck2, Plus } from "lucide-react";
import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  Input,
  Page,
  PageHeader,
  Skeleton,
  Textarea,
  toast,
} from "@/components/ui";
import { useI18n } from "@/i18n";
import { lk, saveDisclaimer, useDisclaimers, type Disclaimer } from "@/lib/api/libraries";
import { usePreflightText } from "@/features/review/model";
import { OrgSelect } from "./OrgSelect";
import { useOrgPicker } from "./orgPicker";

const split = (s: string) =>
  s
    .split(/[,،\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

/** /disclaimers — approved required wording (admins); platform templates are proposals only. */
export function DisclaimersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const picker = useOrgPicker();
  const list = useDisclaimers(picker.orgId);
  const [editing, setEditing] = useState<Disclaimer | "new" | null>(null);
  const manager = ["owner", "admin"].includes(picker.role ?? "");
  if (picker.orgs.isPending)
    return (
      <Page>
        <Skeleton className="h-40 w-full rounded-lg" />
      </Page>
    );
  return (
    <Page className="flex flex-col gap-6">
      <PageHeader
        title={t("disclaimers.title")}
        description={t("disclaimers.subtitle")}
        actions={
          manager ? (
            <Button icon={<Plus />} onClick={() => setEditing("new")}>
              {t("disclaimers.add")}
            </Button>
          ) : undefined
        }
      />
      <OrgSelect picker={picker} />
      {!manager && <p className="text-sm text-fg-muted">{t("disclaimers.onlyManagers")}</p>}
      {list.isPending ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : !list.data?.length ? (
        <EmptyState icon={<FileCheck2 />} title={t("disclaimers.empty")} />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="disclaimers-list">
          {list.data.map((d) => (
            <li key={d.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-fg">{d.name || "—"}</span>
                  {d.is_template ? (
                    <Badge variant="neutral">{t("disclaimers.template")}</Badge>
                  ) : (
                    <Badge>{t("products.version", { n: d.version })}</Badge>
                  )}
                  {d.required_by_rule_codes.map((c) => (
                    <Badge key={c} mono>
                      {c}
                    </Badge>
                  ))}
                </div>
                <p dir="auto" className="text-sm text-fg">
                  «{d.text_ar}»
                </p>
                {manager && (
                  <div className="flex gap-2 border-t border-border pt-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditing(d)}>
                      {d.is_template ? t("disclaimers.adopt") : t("products.edit")}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <DisclaimerDialog
          orgId={picker.orgId}
          d={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: lk.disclaimers(picker.orgId) });
          }}
        />
      )}
    </Page>
  );
}

function DisclaimerDialog({
  orgId,
  d,
  onClose,
  onSaved,
}: {
  orgId: string;
  d: Disclaimer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const errText = usePreflightText();
  const [name, setName] = useState(d?.is_template ? "" : (d?.name ?? ""));
  const [text, setText] = useState(d?.text_ar ?? "");
  const [requiredBy, setRequiredBy] = useState((d?.required_by_rule_codes ?? []).join(", "));
  const [comm, setComm] = useState((d?.communication_types ?? []).join(", "));
  const [prominence, setProminence] = useState(d?.check_prominence ?? false);
  const save = useMutation({
    mutationFn: () =>
      saveDisclaimer({
        id: d && !d.is_template ? d.id : null,
        orgId,
        name,
        textAr: text,
        textEn: d?.text_en ?? "",
        productTypes: d?.product_types ?? [],
        channels: d?.channels ?? [],
        communicationTypes: split(comm),
        requiredBy: split(requiredBy).map((x) => x.toUpperCase()),
        prominence,
        status: "active",
      }),
    onSuccess: () => {
      toast.success(t("claims.saved"));
      onSaved();
    },
    onError: (e) => toast.error(errText(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={d && !d.is_template ? t("products.edit") : t("disclaimers.add")}
      description={d?.is_template ? t("disclaimers.templateNote") : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button loading={save.isPending} disabled={!text.trim()} onClick={() => save.mutate()}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t("claims.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} dir="auto" />
        </Field>
        <Field label={t("disclaimers.text")}>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} dir="rtl" />
        </Field>
        <Field
          label={t("disclaimers.requiredBy")}
          hint={t("disclaimers.requiredByHint")}
          optional
          optionalLabel={t("common.optional")}
        >
          <Input value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} dir="ltr" />
        </Field>
        <Field
          label={t("promo.communicationType")}
          hint={t("disclaimers.scopeHint")}
          optional
          optionalLabel={t("common.optional")}
        >
          <Input value={comm} onChange={(e) => setComm(e.target.value)} dir="ltr" />
        </Field>
        <Checkbox
          label={t("disclaimers.prominence")}
          hint={t("disclaimers.prominenceHint")}
          checked={prominence}
          onChange={(e) => setProminence(e.target.checked)}
        />
      </div>
    </Dialog>
  );
}
