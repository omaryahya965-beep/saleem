import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardTitle, Checkbox, Skeleton, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { FEATURE_FLAGS, flagOn, setFeatures } from "@/lib/api/flows";
import { pk, useOrgSettings } from "@/lib/api/promotions";

/** Owners/admins turn the Phase 6 workflows on for their organisation. Every flag starts off. */
export function FeatureFlagsCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const settings = useOrgSettings(orgId);
  const save = useMutation({
    mutationFn: (next: Record<string, boolean>) => setFeatures(orgId, next),
    onSuccess: () => {
      toast.success(t("flags.saved"));
      void qc.invalidateQueries({ queryKey: pk.orgSettings(orgId) });
    },
    onError: () => toast.error(t("errors.generic")),
  });
  const current = (settings.data?.features ?? {}) as Record<string, unknown>;
  return (
    <Card className="flex flex-col gap-3" data-testid="feature-flags">
      <CardTitle>{t("flags.title")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("flags.subtitle")}</p>
      {settings.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : !settings.data ? (
        <p className="text-sm text-fg-muted">{t("flags.noSettings")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {FEATURE_FLAGS.map((f) => (
            <li key={f}>
              <Checkbox
                label={t(`flags.${f}` as TKey)}
                hint={t(`flags.${f}Hint` as TKey)}
                checked={flagOn(settings.data!.features, f)}
                disabled={save.isPending}
                onChange={(e) => {
                  const next: Record<string, boolean> = {};
                  for (const [k, v] of Object.entries(current))
                    if (typeof v === "boolean") next[k] = v;
                  next[f] = e.target.checked;
                  save.mutate(next);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
