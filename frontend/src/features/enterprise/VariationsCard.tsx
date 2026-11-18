import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Send } from "lucide-react";
import { useState } from "react";
import { Button, Card, CardTitle, Field, Input, toast } from "@/components/ui";
import { useI18n, type TKey } from "@/i18n";
import { usePreflightText } from "@/features/review/model";
import { createVariation, fetchVariations, flagOn, submitVariations } from "@/lib/api/flows";
import { useOrgSettings, type Promotion } from "@/lib/api/promotions";

/** Variations of a promotion: shared context, separate decisions, bulk submit (Phase 6.4). */
export function VariationsCard({
  promotion: p,
  canEdit,
}: {
  promotion: Promotion;
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const settings = useOrgSettings(p.org_id);
  const errText = usePreflightText();
  const [title, setTitle] = useState("");
  const group = useQuery({
    queryKey: ["variations", p.variation_group_id],
    queryFn: () => fetchVariations(p.variation_group_id!),
    enabled: Boolean(p.variation_group_id),
  });
  const add = useMutation({
    mutationFn: () => createVariation(p.id, title),
    onSuccess: (id) => {
      toast.success(t("variations.created"));
      setTitle("");
      void navigate({ to: "/promotions/$id", params: { id } });
    },
    onError: (e) => toast.error(errText(e)),
  });
  const bulk = useMutation({
    mutationFn: () => submitVariations(p.variation_group_id!),
    onSuccess: (r) => {
      toast.success(t("variations.bulkDone", { n: r.submitted.length, m: r.skipped.length }));
      void qc.invalidateQueries({ queryKey: ["variations", p.variation_group_id] });
      void qc.invalidateQueries({ queryKey: ["promotion", p.id] });
    },
    onError: (e) => toast.error(errText(e)),
  });
  if (!p.org_id || p.is_demo || !flagOn(settings.data?.features, "upload_types")) return null;
  const others = (group.data ?? []).filter((x) => x.id !== p.id);
  return (
    <Card className="flex flex-col gap-3" data-testid="variations-card">
      <CardTitle>{t("variations.title")}</CardTitle>
      <p className="text-sm text-fg-muted">{t("variations.subtitle")}</p>
      {others.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {others.map((v) => (
            <li key={v.id} className="flex flex-wrap gap-2">
              <Link
                to="/promotions/$id"
                params={{ id: v.id }}
                className="font-medium underline-offset-2 hover:underline"
                dir="auto"
              >
                {v.title}
              </Link>
              <span className="text-fg-muted">
                {t(`promo.reviewStatus.${v.review_status}` as TKey)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={t("variations.newTitle")} className="min-w-56 flex-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" />
          </Field>
          <Button
            variant="secondary"
            icon={<Copy />}
            disabled={!title.trim()}
            loading={add.isPending}
            onClick={() => add.mutate()}
          >
            {t("variations.add")}
          </Button>
          {others.length > 0 && (
            <Button icon={<Send />} loading={bulk.isPending} onClick={() => bulk.mutate()}>
              {t("variations.submitAll")}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
