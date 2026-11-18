import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useErrorText } from "@/components/feedback/ApiErrorState";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, CardTitle, Field, Input, Select, Skeleton, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { SECTORS, dbErrorCode, pk, updateOrgSettings, useOrgSettings } from "@/lib/api/promotions";
import { splitAliases } from "@/features/products/model";

/** Basic organisation settings (Phase 1): sector and brand names. Owners and admins edit. */
export function OrgSettingsCard({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const { t } = useI18n();
  const errText = useErrorText();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const [sector, setSector] = useState("");
  const [aliases, setAliases] = useState("");
  useEffect(() => {
    if (!settings.data) return;
    setSector(settings.data.sector ?? "");
    setAliases(settings.data.brand_aliases.join("، "));
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      updateOrgSettings(orgId, { sector: sector || null, brand_aliases: splitAliases(aliases) }),
    onSuccess: () => {
      toast.success(t("orgSettings.saved"));
      void qc.invalidateQueries({ queryKey: pk.orgSettings(orgId) });
    },
    onError: (e) => toast.error(t(`promo.errors.${dbErrorCode(e) ?? "forbidden"}` as TKey)),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Card className="flex flex-col gap-4" data-testid="org-settings">
      <CardTitle>{t("orgSettings.title")}</CardTitle>
      {settings.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : settings.isError || !settings.data ? (
        <p className="text-sm text-red" role="alert">
          {errText(settings.error)}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("orgSettings.sector")}>
              <Select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                disabled={!canEdit}
              >
                <option value="">{t("orgSettings.sectorNone")}</option>
                {SECTORS.map((s) => (
                  <option key={s} value={s}>
                    {t(`products.sectorOpt.${s}` as TKey)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("orgSettings.brandAliases")} hint={t("orgSettings.brandAliasesHint")}>
              <Input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                disabled={!canEdit}
                dir="auto"
              />
            </Field>
          </div>
          {canEdit ? (
            <Button type="submit" loading={save.isPending} className="self-end">
              {t("common.save")}
            </Button>
          ) : (
            <p className="text-sm text-fg-muted">{t("orgSettings.readOnly")}</p>
          )}
        </form>
      )}
    </Card>
  );
}
